# 2026-10-10 实际加载闭包验收

本次把 LittleWhiteBox 的 NovelAI 源码依赖按原相对目录复制到项目根目录：`core/`、`modules/draw/`、`modules/agent-core/`、`shared/`、`widgets/` 与 `libs/`。浏览器入口现在是根 `index.js`，只负责花漫画设置抽屉和启用/禁用状态；原 NovelAI iframe、悬浮胶囊、楼层按钮、画廊、提示词、角色学习、世界书、恢复与后台任务代码由源模块提供。

验证：

- `module-closure.test.mjs` 解析 107 个浏览器模块，未发现项目内缺失相对模块；SillyTavern 核心相对导入列为宿主边界。
- SillyTavern manifest validator 通过。
- `npm run test:smoke` 通过：核心、服务端插件、20 条路由、提示词/学习、V5 流、传输模式、安装布局均通过。
- 全部 JS/MJS 语法检查通过。

服务端端点已统一为 `/api/plugins/sillytavern-novelai`，`install.ps1` 安装到第三方扩展目录和 `plugins/sillytavern-novelai`。真实浏览器启动、实际 NovelAI API 生图仍需在用户的 SillyTavern 实例中验收；本地没有使用 API Key，也没有伪造该结果。
