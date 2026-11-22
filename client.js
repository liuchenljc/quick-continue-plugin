/**
 * Client half of dsh-quick-continue.
 *
 * The row of one-click reply buttons sits in `conversation.composer.dock`, the
 * ambient strip under the composer card. The editor panel renders in the
 * frame-wide `shell.overlay` layer so the transcript scroller can never clip it
 * and it cannot make the page taller.
 *
 * Sending never touches the draft. It goes through the same Client API the
 * official composer uses —
 *   ctx.sessions.binding(sessionId).session.prompt([{type:'text',text}], 'queue')
 * — which appends to the session queue and leaves whatever you are typing
 * exactly as it was. An earlier revision used inputActions.setDraft + submit,
 * which overwrote the draft on every click.
 *
 * The button list lives in localStorage, so it is editable from the gear panel
 * and survives reloads without a Host bridge.
 */
window.__ModuleLoader__.load({
  id: 'dsh-quick-continue',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useSyncExternalStore } = React;

    const NS = 'dsh.quickContinue';
    const STORAGE_KEY = 'dsh-quick-continue.shortcuts.v1';

    /* ------------------------------------------------------------- dictionaries */

    const en = {
      edit: 'Edit quick replies',
      title: 'Quick replies',
      hint: 'Each button sends its own text as the next message. Your draft is never overwritten.',
      labelField: 'Button name',
      labelPlaceholder: 'Continue',
      textField: 'Text to send',
      textPlaceholder: 'The message this button sends…',
      add: 'Add a button',
      reset: 'Restore defaults',
      close: 'Close',
      remove: 'Remove',
      moveUp: 'Move up',
      moveDown: 'Move down',
      empty: 'No buttons. Click "Add a button" to make one.',
      sendFailed: 'Send failed: ',
      sessionUnavailable: 'session not ready',
    };

    const zh = {
      edit: '编辑快捷回复',
      title: '快捷回复',
      hint: '每个按钮点一下就把自己的文字作为下一条消息发出，不会覆盖你正在写的草稿。',
      labelField: '按钮名称',
      labelPlaceholder: '继续',
      textField: '发送的文字',
      textPlaceholder: '这个按钮发出去的内容…',
      add: '添加按钮',
      reset: '恢复默认',
      close: '关闭',
      remove: '删除',
      moveUp: '上移',
      moveDown: '下移',
      empty: '还没有按钮，点「添加按钮」新建一个。',
      sendFailed: '发送失败：',
      sessionUnavailable: '会话尚未就绪',
    };

    /* ------------------------------------------------------------------ defaults */

    const DEFAULT_SHORTCUTS = [
      { id: 'continue', label: '继续', text: '继续' },
      { id: 'a', label: 'A', text: 'A' },
      { id: 'b', label: 'B', text: 'B' },
      { id: 'c', label: 'C', text: 'C' },
      { id: 'you-decide', label: '你来定', text: '你来定' },
    ];

    let sequence = 0;

    function mintId() {
      sequence += 1;
      return 'qc' + Date.now().toString(36) + sequence.toString(36);
    }

    function normalizeShortcut(raw) {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
      const text = typeof raw.text === 'string' ? raw.text : '';
      if (text.trim() === '') return undefined;
      const label = typeof raw.label === 'string' && raw.label.trim() !== '' ? raw.label : text;
      const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : mintId();
      return { id, label, text };
    }

    function normalizeList(raw) {
      if (!Array.isArray(raw)) return undefined;
      const list = raw.map(normalizeShortcut).filter((entry) => entry !== undefined);
      const seen = new Set();
      return list.filter((entry) => (seen.has(entry.id) ? false : (seen.add(entry.id), true)));
    }

    function defaults() {
      return DEFAULT_SHORTCUTS.map((entry) => ({ id: entry.id, label: entry.label, text: entry.text }));
    }

    /* --------------------------------------------------------------------- store */

    function readStored() {
      if (typeof localStorage === 'undefined') return defaults();
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return defaults();
        return normalizeList(JSON.parse(raw)) ?? defaults();
      } catch {
        return defaults();
      }
    }

    function persist(list) {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {
        /* a full or disabled store only costs persistence, never the row itself */
      }
    }

    /** Shortcut list with a stable snapshot for useSyncExternalStore. */
    const shortcuts = (function createShortcutStore() {
      let current = readStored();
      const listeners = new Set();
      function emit() {
        for (const listener of Array.from(listeners)) listener();
      }
      return {
        getSnapshot() {
          return current;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        set(list) {
          current = list;
          persist(current);
          emit();
        },
        update(mutate) {
          this.set(mutate(current.slice()));
        },
      };
    })();

    function useShortcuts() {
      return useSyncExternalStore(shortcuts.subscribe, shortcuts.getSnapshot);
    }

    /* ------------------------------------------------------------ panel + notice */

    function createFlagStore(initial) {
      let current = initial;
      const listeners = new Set();
      function emit() {
        for (const listener of Array.from(listeners)) listener();
      }
      return {
        getSnapshot() {
          return current;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        set(value) {
          if (Object.is(current, value)) return;
          current = value;
          emit();
        },
      };
    }

    const panelOpen = createFlagStore(false);

    function usePanelOpen() {
      return useSyncExternalStore(panelOpen.subscribe, panelOpen.getSnapshot);
    }

    /** Transient one-line failure message rendered inside the dock row. */
    const notice = createFlagStore(null);
    let noticeTimer;

    function raiseNotice(message) {
      notice.set(message);
      if (noticeTimer !== undefined) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        notice.set(null);
        noticeTimer = undefined;
      }, 4000);
    }

    function useNotice() {
      return useSyncExternalStore(notice.subscribe, notice.getSnapshot);
    }

    /* --------------------------------------------------------------------- send */

    /**
     * Admit one text prompt into the addressed Session in queue mode, matching
     * the composer's own submission path minus the draft echo and attachments.
     */
    async function sendText(sessions, sessionId, text, t) {
      const binding = sessions.binding(sessionId);
      if (binding === undefined) {
        raiseNotice(t.sendFailed + t.sessionUnavailable);
        return;
      }
      try {
        const result = await binding.session.prompt([{ type: 'text', text }], 'queue');
        if (result.ok === false) {
          const failure = result.error;
          const detail = failure === undefined ? 'unknown' : String(failure.message ?? failure.code);
          raiseNotice(t.sendFailed + detail);
        }
      } catch (error) {
        raiseNotice(t.sendFailed + (error instanceof Error ? error.message : String(error)));
      }
    }

    /* -------------------------------------------------------------------- styles */

    const rowStyle = {
      display: 'flex',
      flexDirection: 'row',
      gap: '6px',
      alignItems: 'center',
      flexWrap: 'wrap',
      padding: '2px 2px 4px',
    };

    const chipStyle = {
      appearance: 'none',
      border: '1px solid var(--dsw-alias-border-l2)',
      background: 'var(--dsw-alias-bg-layer-1)',
      color: 'var(--dsw-alias-label-primary)',
      borderRadius: '999px',
      padding: '3px 14px',
      fontSize: '13px',
      lineHeight: '1.5',
      cursor: 'pointer',
      maxWidth: '16em',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    };

    const gearStyle = {
      appearance: 'none',
      border: '1px solid var(--dsw-alias-border-l1)',
      background: 'transparent',
      color: 'var(--dsw-alias-label-secondary)',
      borderRadius: '999px',
      width: '26px',
      height: '26px',
      padding: '0',
      fontSize: '13px',
      lineHeight: '1',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none',
    };

    const noticeStyle = {
      color: 'var(--dsw-alias-state-error-primary)',
      fontSize: '12px',
      lineHeight: '1.4',
      maxWidth: '28em',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    };

    const panelStyle = {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: '112px',
      zIndex: 60,
      pointerEvents: 'auto',
      boxSizing: 'border-box',
      width: 'min(560px, calc(100vw - 32px))',
      maxHeight: 'min(60vh, 520px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '14px',
      border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: '14px',
      background: 'var(--dsw-alias-bg-overlay)',
      color: 'var(--dsw-alias-label-primary)',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
      fontSize: '13px',
    };

    const rowCardStyle = {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '10px',
      border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: '10px',
      background: 'var(--dsw-alias-bg-layer-1)',
    };

    const fieldLabelStyle = {
      fontSize: '11px',
      lineHeight: '1.4',
      color: 'var(--dsw-alias-label-secondary)',
    };

    const inputStyle = {
      boxSizing: 'border-box',
      width: '100%',
      border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: '8px',
      background: 'var(--dsw-alias-bg-base)',
      color: 'var(--dsw-alias-label-primary)',
      fontSize: '13px',
      lineHeight: '1.5',
      padding: '5px 8px',
      font: 'inherit',
    };

    const smallButtonStyle = {
      appearance: 'none',
      border: '1px solid var(--dsw-alias-border-l1)',
      background: 'transparent',
      color: 'var(--dsw-alias-label-secondary)',
      borderRadius: '8px',
      padding: '2px 8px',
      fontSize: '12px',
      lineHeight: '1.6',
      cursor: 'pointer',
      flex: 'none',
    };

    const primaryButtonStyle = {
      appearance: 'none',
      border: '1px solid var(--dsw-alias-border-l2)',
      background: 'var(--dsw-alias-bg-layer-2)',
      color: 'var(--dsw-alias-label-primary)',
      borderRadius: '8px',
      padding: '4px 12px',
      fontSize: '12px',
      lineHeight: '1.6',
      cursor: 'pointer',
    };

    /* ------------------------------------------------------------------ components */

    function QuickContinueRow(props) {
      const sessionId = props.sessionId;
      const sessions = props.sessions;
      const t = props.t;
      const list = useShortcuts();
      const message = useNotice();
      if (sessionId === undefined || sessions === undefined) return null;
      return h('div', { 'data-quick-continue': 'true', style: rowStyle }, [
        ...list.map((shortcut) => h('button', {
          key: shortcut.id,
          type: 'button',
          title: shortcut.text,
          style: chipStyle,
          onClick: () => {
            void sendText(sessions, sessionId, shortcut.text, t);
          },
        }, shortcut.label)),
        h('button', {
          key: '__edit',
          type: 'button',
          title: t.edit,
          'aria-label': t.edit,
          style: gearStyle,
          onClick: () => {
            panelOpen.set(!panelOpen.getSnapshot());
          },
        }, '\u2699'),
        message === null ? null : h('span', { key: '__notice', style: noticeStyle }, message),
      ]);
    }

    function ShortcutCard(props) {
      const shortcut = props.shortcut;
      const index = props.index;
      const total = props.total;
      const t = props.t;
      const patch = (fields) => {
        shortcuts.update((list) => {
          if (index < 0 || index >= list.length) return list;
          list[index] = { ...list[index], ...fields };
          return list;
        });
      };
      const move = (delta) => {
        shortcuts.update((list) => {
          const target = index + delta;
          if (index < 0 || target < 0 || target >= list.length) return list;
          const [moved] = list.splice(index, 1);
          list.splice(target, 0, moved);
          return list;
        });
      };
      const remove = () => {
        shortcuts.update((list) => {
          list.splice(index, 1);
          return list;
        });
      };
      return h('div', { style: rowCardStyle }, [
        h('label', { key: 'label', style: fieldLabelStyle }, t.labelField,
          h('input', {
            type: 'text',
            value: shortcut.label,
            placeholder: t.labelPlaceholder,
            style: { ...inputStyle, marginTop: '3px' },
            onChange: (event) => patch({ label: event.target.value }),
          })),
        h('label', { key: 'text', style: fieldLabelStyle }, t.textField,
          h('textarea', {
            value: shortcut.text,
            placeholder: t.textPlaceholder,
            rows: 2,
            style: { ...inputStyle, marginTop: '3px', resize: 'vertical', minHeight: '42px' },
            onChange: (event) => patch({ text: event.target.value }),
          })),
        h('div', { key: 'actions', style: { display: 'flex', gap: '6px', justifyContent: 'flex-end' } }, [
          h('button', {
            key: 'up', type: 'button', title: t.moveUp, 'aria-label': t.moveUp,
            disabled: index === 0, style: smallButtonStyle, onClick: () => move(-1),
          }, '\u2191'),
          h('button', {
            key: 'down', type: 'button', title: t.moveDown, 'aria-label': t.moveDown,
            disabled: index === total - 1, style: smallButtonStyle, onClick: () => move(1),
          }, '\u2193'),
          h('button', {
            key: 'remove', type: 'button', title: t.remove, 'aria-label': t.remove,
            style: smallButtonStyle, onClick: remove,
          }, '\u2715'),
        ]),
      ]);
    }

    function QuickContinuePanel(props) {
      const t = props.t;
      const open = usePanelOpen();
      const list = useShortcuts();
      if (!open) return null;
      return h('div', { 'data-quick-continue-panel': 'true', style: panelStyle }, [
        h('div', {
          key: 'header',
          style: { display: 'flex', alignItems: 'center', gap: '8px' },
        }, [
          h('strong', { key: 'title', style: { fontSize: '13px', fontWeight: '600' } }, t.title),
          h('span', {
            key: 'hint',
            style: { flex: '1', minWidth: '0', fontSize: '11px', lineHeight: '1.4', color: 'var(--dsw-alias-label-secondary)' },
          }, t.hint),
          h('button', {
            key: 'close', type: 'button', title: t.close, 'aria-label': t.close,
            style: smallButtonStyle, onClick: () => panelOpen.set(false),
          }, '\u2715'),
        ]),
        h('div', {
          key: 'list',
          style: { display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', minHeight: '0' },
        }, list.length === 0
          ? [h('div', { key: 'empty', style: { ...fieldLabelStyle, padding: '6px 0' } }, t.empty)]
          : list.map((shortcut, index) => h(ShortcutCard, {
            key: shortcut.id,
            shortcut,
            index,
            total: list.length,
            t,
          }))),
        h('div', {
          key: 'footer',
          style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', flex: 'none' },
        }, [
          h('button', {
            key: 'reset', type: 'button', style: smallButtonStyle,
            onClick: () => shortcuts.set(defaults()),
          }, t.reset),
          h('button', {
            key: 'add', type: 'button', style: primaryButtonStyle,
            onClick: () => {
              shortcuts.update((current) => [...current, {
                id: mintId(),
                label: '',
                text: '',
              }]);
            },
          }, t.add),
        ]),
      ]);
    }

    /* --------------------------------------------------------------------- apply */

    return {
      inject: ['slots', 'locale', 'sessions'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'quick-continue: dictionaries');
        const sessions = ctx.sessions;

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'quick-continue',
          order: 5,
          locale: NS,
          inject: () => ({ sessions }),
        }, QuickContinueRow));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'quick-continue-panel',
          order: 55,
          locale: NS,
        }, QuickContinuePanel));
      },
    };
  },
});
