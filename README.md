# 花漫画

独立的花漫画 NovelAI 插件项目。运行时不依赖 LittleWhiteBox。

## 安装

1. 将 `server-plugin/sillytavern-novelai` 整个目录复制到 SillyTavern 的 `plugins/sillytavern-novelai`。
2. 在 SillyTavern `config.yaml` 开启 `enableServerPlugins: true`。
3. 将 `public/scripts/extensions/novelai` 复制到 SillyTavern 对应的 `public/scripts/extensions/novelai`。
4. 重启 SillyTavern，并在扩展面板确认 花漫画 NovelAI 扩展已加载。

## 项目文件说明

- `public/scripts/extensions/novelai`：浏览器端 SillyTavern 扩展及其 manifest。
- `server-plugin/sillytavern-novelai`：可复制到 `plugins/` 的独立服务端插件，包含自己的 `package.json`。
- `modules/novelai/core`：与宿主无关的 NovelAI 协议和提示词核心。
- `tests/novelai`：离线 smoke 检查，可运行 `npm run test:smoke`。
- `docs/`：迁移清单、来源、加载边界和验收记录。

根级 `package.json` 只用于统一 Node 版本说明和离线检查，不是 SillyTavern 的运行时插件入口；真正被 SillyTavern 加载的是 `server-plugin/sillytavern-novelai` 中的 `index.js`/`manifest.json`，以及扩展目录中的 `manifest.json`。

服务端路由前缀为 `/api/plugins/sillytavern-novelai`。插件提供 NovelAI Legacy/V4/V4.5、V5 MessagePack 流、连接测试和异步图片任务。

## 当前边界

NovelAI 协议核心与服务端传输已独立化；前端页面和浮动控件正在进行 SillyTavern 宿主适配。LittleWhiteBox 目录、模块和运行时不会被安装或导入。

详细迁移记录见 `docs/`。

