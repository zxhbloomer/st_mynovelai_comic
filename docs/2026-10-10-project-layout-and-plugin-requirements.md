# 花漫画项目整理与插件要求

## 已核对的 SillyTavern 事实

服务端插件由 SillyTavern 的 `plugins/<plugin-id>` 目录加载，入口需要导出 `info`、`init` 和 `exit` 生命周期；本项目入口是 `server-plugin/sillytavern-novelai/index.js`，安装后目录名为 `sillytavern-novelai`。服务端插件还需要在 SillyTavern 配置中开启 `enableServerPlugins: true`。

浏览器端扩展使用 `public/scripts/extensions/<name>/manifest.json`，由 manifest 指向 `index.js` 和 CSS；它与服务端插件是两个加载边界，不能把其中一个当作另一个的替代品。

这些要求与 SillyTavern 官方插件示例的 README 和仓库结构一致，参考：

- https://github.com/SillyTavern/SillyTavern-DiscordRichPresence-Server
- https://github.com/SillyTavern/SillyTavern-EdgeTTS-Plugin
- https://github.com/SillyTavern/SillyTavern-Office-Parser

## 文件取舍

- 保留 `docs/`、`modules/`、`public/`、`server-plugin/`、`tests/`、`install.ps1` 和 `README.md`。
- 保留服务端插件自己的 `package.json`，因为它是插件发布单元的元数据和 Node 版本声明。
- 增加根级 `package.json`，仅提供项目说明和离线 smoke 命令，不作为 SillyTavern 运行时入口。
- 增加 `.gitignore`，排除依赖目录、生成输出、环境变量和编辑器文件。
- 增加 `.gitattributes`，统一文本换行并标记二进制资源。
- 清理空目录和本地生成残留：`.npm`、`node_modules`、`output`、`assets`、`bridges`、`scripts`、`shared`。

## 尚未声称完成的验收

离线 smoke 检查不能替代真实 SillyTavern 重新发现、真实 NovelAI API Key 生图和浏览器交互验收；这些仍需在干净宿主中单独验证。
