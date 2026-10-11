# 花漫画

独立的花漫画 NovelAI 插件项目。运行时不依赖 LittleWhiteBox。

## 安装

通过 SillyTavern 的“安装扩展”输入本仓库地址时，仓库根目录的 `manifest.json` 会让浏览器扩展被发现。该方式只安装前端扩展；若要启用服务端代理、V5 MessagePack 和后台任务，还需要按下面步骤安装服务端插件。

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


## 1.1.0：三种 LLM 生图规则

提示词模板顶部选择①插图点（默认）、②文章中或③文章末尾，并保存到当前提示词预设。②③沿用完整漫画分段协议，描述和改写参考随图片版本存入现有 IndexedDB，正文只保留图片位置；新小铅笔支持历史描述、结构化编辑、AI 改写草稿和重画。重画使用当前绘图设置、模型及发送渠道，①原流程不变。

后续本功能更新递增 `1.1.x`。需求与实施验证记录见 `docs/`。版本号不是实际酒馆验收证明；浏览器数据库清空后不保证完整历史和描述恢复。

## 1.1.1：删除、历史选择和缓存回退修复

正文图片、图库和设置页图库共用删除处理；新小铅笔切换普通历史版本同步聊天保存记录。缓存清空后，仍有服务器地址及完整描述的图片可恢复编辑和重画；只有图片地址不能恢复 AI 改写依据。②③支持在已有图片槽位的正文上新增任务，不改变参考段落规则。聊天图片在所属聊天中删除，服务器文件仍按现有规则保留。

自动验证不代表真实酒馆或真实 LLM／绘图接口已验收。
