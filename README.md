# 快捷回复按钮 · Quick reply buttons

DeepSeek Harness（DSH）插件：在网页输入框下方加一排**一键回复按钮**，不方便打字也能顺畅对话。

本插件由两半组成，各自独立可用：

| 半边 | 作用 |
|---|---|
| **客户端** | 输入框下方渲染一排按钮，点一下把该按钮的文字作为下一条消息发出 |
| **Host 侧** | 注入系统提示词，让模型的每条回复结尾都带一行对应的 A/B/C 选项 |

两半合起来形成「点击闭环」：回复给什么选项，按钮就是什么；按钮点下去，回的正是那个选项。

## 功能

- 输入框下方渲染一排快捷按钮，默认 **继续 / A / B / C / 你来定**
- **点齿轮可就地编辑**：改名、改发送内容、增删、上下调序，存在 `localStorage`，刷新后还在
- 点击按钮 = **按队列投递**（`session.prompt(content, 'queue')`），**不会覆盖你正在写的草稿**
- 发送失败（会话未就绪、被拒绝等）时，那一行直接给出简短提示，不静默失败
- Host 侧注册系统提示词：所有模型的回复结尾都带一行简短的 A/B/C 选项，与按钮形成点击闭环
- **你来定**：选项拿不准时点它，AI 会替你选最合适的一个并继续执行，只说明一句理由，不再反问

## 安装

**方式一：插件市场（推荐）**

在 DSH 的 **插件 → 发现** 页添加索引源：

```
https://raw.githubusercontent.com/liuchenljc/quick-continue-plugin/main/market-index.json
```

然后在列表中找到「快捷回复按钮」，点安装即可。

**方式二：手动**

1. 下载本仓库（`git clone` 或 Code → Download ZIP 后解压）
2. 在 DSH 的插件管理中安装该目录
3. 刷新网页即可看到按钮；Host 侧提示词需重启 DSH 生效

## 自定义

- **按钮列表**：点按钮行末尾的 ⚙ 就地编辑，或用「恢复默认」重置
- **提示词内容**：编辑 `index.js` 中的 `QUICK_REPLY_PROMPT`
- 改完后重新安装本目录并刷新

## 与同类插件的区别

商店里已有多款「输入框快捷按钮」插件（例如 `dsh-quick-send`、`dsh-prompt-shortcuts`、`dsh-button`），它们的按钮能力更丰富。区别在于**只有本插件同时改写了模型侧的回复习惯**：按钮与回复里的 A/B/C 选项由同一段系统提示词保证对齐，不需要你手动维护两边一致。如果你只想要按钮，用它们中的任意一个即可；如果你想让模型固定按 A/B/C 收尾并配好对应按钮，用本插件。

## 文件结构

| 文件 | 作用 |
|---|---|
| `client.js` | 客户端：渲染按钮行与编辑面板、队列投递 |
| `index.js` | Host：注册系统提示词 |
| `cordis.patch.yml` | 插件挂载配置 |
| `locale/` | 界面与元数据文案 |
| `market-index.json` | 插件市场索引 |
| `icon.svg` | 插件图标 |

纯本地运行，无外部依赖、无原生模块、无构建步骤。

---

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
