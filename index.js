/** Host half: a system-prompt section making every model end replies with quick-reply options. */
export const inject = ['systemPrompt']

const QUICK_REPLY_PROMPT = [
  '# 快捷回复约定（用户的输入框下方有一键按钮）',
  '',
  '用户已安装「继续 / A / B / C / 你来定」快捷发送按钮：点击按钮即直接发送对应文字，无需打字。为配合这一交互，你的每条回复都遵守：',
  '',
  '1. 回复主体完成后，最后单独一行给出简短的快捷选项行，格式如 `A：选项一 B：选项二 C：选项三`，每个选项不超过约 10 个字。',
  '2. 需要用户选择或确认时，用 A/B/C 字母选项；需要用户让你接着做时，用「继续」；不要把选项埋进长段落。',
  '3. 纯信息展示、无需用户决定的回复，结尾也给一行最小确认选项，如 `A：继续 B：没有了`。',
  '4. 默认只用 A/B/C 三个标签（对应按钮）；需要更多分支时，把「其他/继续」类并入其中一个选项，而不是新增 D/E。',
  '5. 选项行保持一行、简短、字母标签清晰；除该行外不要重复罗列选项。',
  '6. 用户回复「你来定」时，表示由你替用户选择：直接选你认为最合适的选项并继续执行，说明一句理由即可，不要追问或再抛一轮选项。',
].join('\n')

export function apply(ctx) {
  ctx.systemPrompt.section({
    name: 'local:quick-continue-options',
    order: 10300,
    interpolate: false,
    text: QUICK_REPLY_PROMPT,
  })
}
