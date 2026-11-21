# Quick Continue · 快捷回复按钮

DeepSeek Harness（DSH）插件：在网页输入框下方加一排**一键快捷按钮**，不方便打字也能顺畅对话。

## 功能

- 输入框下方渲染 **继续 / A / B / C / 你来定** 五个按钮
- 点击按钮 = 直接发送对应文字，与手动输入后点发送完全一致
- Host 侧注册系统提示词：所有模型的回复结尾都会带一行简短的 A/B/C 选项，与按钮形成「点击闭环」
- **你来定**：选项拿不准时点它，AI 会替你选最合适的一个并继续执行，只说明一句理由，不再反问

## 安装

**方式一：插件市场（推荐）**

在 DSH 的 **插件 → 发现** 页添加索引源：

```
https://raw.githubusercontent.com/liuchenljc/quick-continue-plugin/main/market-index.json
```

然后在列表中找到「快捷继续」，点安装即可。

**方式二：手动**

1. 下载本仓库（`git clone` 或 Code → Download ZIP 后解压）
2. 在 DSH 的插件管理中安装该目录
3. 刷新网页即可看到按钮；Host 侧提示词需重启 DSH 生效

## 自定义

- 按钮列表：编辑 `client.js` 顶部的 `REPLIES` 数组（如加「1」「好的」等）
- 提示词内容：编辑 `index.js` 中的 `QUICK_REPLY_PROMPT`
- 改完后重新安装本目录并刷新

## 文件结构

| 文件 | 作用 |
|---|---|
| `client.js` | 客户端：渲染按钮、发送消息 |
| `index.js` | Host：注册系统提示词 |
| `cordis.patch.yml` | 插件挂载配置 |
| `locale/` | 界面文案 |
| `icon.svg` | 插件图标 |

纯本地运行，无外部依赖。

---

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
