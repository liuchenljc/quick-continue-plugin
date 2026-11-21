window.__ModuleLoader__.load({
  id: 'dsh-quick-continue',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Quick replies rendered as one-click send buttons under the composer. */
    const REPLIES = ['继续', 'A', 'B', 'C', '你来定'];

    function QuickContinue({ inputActions, locked }) {
      if (inputActions === undefined || inputActions === null) return null;
      const send = (text) => {
        if (locked === true) return;
        inputActions.setDraft(text);
        inputActions.submit();
      };
      return h('div', {
        'data-quick-continue': 'true',
        style: {
          display: 'flex',
          flexDirection: 'row',
          gap: '6px',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '2px 2px 4px',
        },
      },
      REPLIES.map((text) => h('button', {
        key: text,
        type: 'button',
        onClick: () => send(text),
        disabled: locked === true,
        title: text,
        style: {
          appearance: 'none',
          border: '1px solid var(--dsw-alias-border-l2)',
          background: 'var(--dsw-alias-bg-layer-1)',
          color: 'var(--dsw-alias-label-primary)',
          borderRadius: '999px',
          padding: '3px 14px',
          fontSize: '13px',
          lineHeight: '1.5',
          cursor: locked === true ? 'default' : 'pointer',
        },
      }, text)));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'quick-continue', order: 5,
        }, QuickContinue));
      },
    };
  },
});
