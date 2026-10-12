# 1.2.0 漫画阅读器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变现有三种生图主流程的前提下，增加按故事楼层阅读漫画、跨楼层导航、章节简介、整层重生成和生成遮罩。

**Architecture:** 新增阅读器状态与适配层，统一把①②③模式转换为楼层页面模型；阅读器弹窗只消费该模型。复用现有图片、清空、重点要求、服务器文件接口，新增阅读元数据 JSON，不保存图片 Base64。

**Tech Stack:** 原生 JavaScript、现有 CSS、SillyTavern 用户文件 API、浏览器 IndexedDB/现有图片缓存。

**Spec:** `docs/superpowers/specs/2026-10-12-comic-reader-design.md`

## Global Constraints

- 版本从 1.2.0 开始。
- 不修改安装的 SillyTavern 源码和参考项目。
- 不提交 `dbbak/`、`提示词/`。
- 不把图片 Base64 写入 JSON。
- 提示词由用户模板提供，代码不写死章节提示词。
- 非故事楼层导航时跳过；跨到无漫画故事楼层时停留空页。

## Review Focus

- ①模式缺少章节标签或旧数据：显示暂无，不额外请求模型。
- 图位有历史重画版本：只计当前有效版本。
- 当前楼层是用户/系统/旁白消息：导航不能误选。
- 清空中途失败或用户取消：不能继续生成或误删旧内容。
- 生图期间重复点击、关闭阅读器或切换楼层：任务与遮罩状态不能串楼层。

### Task 1: 版本与阅读数据接口

**Files:**
- Modify: `manifest.json`, `package.json`, `server-plugin/sillytavern-novelai/manifest.json`, `server-plugin/sillytavern-novelai/package.json`
- Create: `modules/draw/shared/comic-reader-storage.js`
- Test: `tests/comic-reader-storage.test.js`（若项目测试目录已有同类运行方式，按其方式接入）

**Interfaces:**
- `loadReaderState(chatId) -> Promise<ReaderState|null>`
- `saveReaderState(chatId, state) -> Promise<void>`
- `clearReaderState(chatId) -> Promise<void>`
- `ReaderState`: `{ version, chatId, floors: { [messageId]: { title, summary, pageIndex } }, lastFloorId }`

- [ ] 编写 JSON 存取和聊天隔离测试。
- [ ] 使用现有 `core/server-storage.js` 对应的用户文件读写接口，文件名固定为项目约定的阅读数据文件；不写死用户目录。
- [ ] 版本号统一提升到 1.2.0。
- [ ] 运行存储测试并提交。

### Task 2: 故事楼层与模式适配

**Files:**
- Create: `modules/draw/shared/comic-reader-model.js`
- Modify: `modules/draw/shared/comic-planning.js`, `modules/draw/shared/comic-generation.js`（仅接入已有输出解析，不改变规划格式）
- Test: `tests/comic-reader-model.test.js`

**Interfaces:**
- `getStoryFloors(chat) -> StoryFloor[]`
- `buildReaderFloor(message, mode, savedState) -> ReaderFloor`
- `getAdjacentStoryFloor(floors, messageId, direction) -> StoryFloor|null`
- `ReaderFloor`: `{ messageId, chapterTitle, summary, pages, hasComic }`

- [ ] 覆盖角色正文、用户消息、系统消息、注释、独立旁白和空正文测试。
- [ ] ①读取现有插图点有效图片；②③读取当前有效图位和章节标签。
- [ ] 历史重画版本不重复进入 `pages`。
- [ ] 章节标签缺失返回“暂无”。
- [ ] 运行模型测试并提交。

### Task 3: 独立阅读器弹窗

**Files:**
- Create: `modules/draw/shared/comic-reader.js`
- Modify: `modules/draw/shared/draw-common.js`（仅复用公共样式/入口注册）
- Test: `tests/comic-reader.test.js`

**Interfaces:**
- `openComicReader({ chatId, messageId }) -> Promise<void>`
- `closeComicReader() -> void`
- `refreshComicReader() -> Promise<void>`
- `setReaderGenerationState(active, message) -> void`

- [ ] 建立独立 DOM、标题、图片、简介、页码、左右箭头、关闭按钮和底部 toolbar。
- [ ] 空楼层显示“本楼层暂无漫画”，仍显示“花漫画”。
- [ ] 左右方向键、Esc、PageUp/PageDown 只在阅读器、确认框和输入框状态允许时生效。
- [ ] 左右翻页跨故事楼层；跨到无漫画楼层停留空页；PageUp/PageDown进入第一张。
- [ ] 记录 `lastFloorId` 和 `pageIndex`，关闭后再次打开可恢复当前聊天记录。
- [ ] 模拟 DOM 测试关键状态转换并提交。

### Task 4: 楼层与全局入口、toolbar

**Files:**
- Modify: `modules/draw/providers/novelai/floating-panel.js`
- Modify: `modules/draw/shared/image-card-actions.js`
- Create: `modules/draw/shared/comic-reader-toolbar.js`
- Test: `tests/comic-reader-toolbar.test.js`

**Interfaces:**
- `openReaderForFloor(messageId) -> Promise<void>`
- `openReaderForLastPosition() -> Promise<void>`
- `renderReaderToolbar(state) -> HTMLElement`

- [ ] 楼层悬浮按钮和全局悬浮按钮增加“阅读漫画”。
- [ ] 全局无阅读记录直接报错；楼层入口遇到非故事楼层按方向跳过。
- [ ] toolbar 只实现紧凑楼层输入、上一/下一故事楼层和“花漫画”，不重建聊天 DOM。
- [ ] 样式参考 ST-Chat-Jumper，但不移植编辑、删除、收藏、换分支等功能。
- [ ] 运行入口测试并提交。

### Task 5: 整层重生成与生成遮罩

**Files:**
- Create: `modules/draw/shared/comic-regeneration.js`
- Create: `modules/draw/shared/generation-overlay.js`
- Modify: `modules/draw/shared/floor-image-clear.js`, `modules/draw/providers/novelai/novel-draw.js`, `modules/draw/shared/draw-focus-dialog.js`
- Test: `tests/comic-regeneration.test.js`

**Interfaces:**
- `regenerateComicFloor({ messageId, chatId, source }) -> Promise<Result>`
- `confirmAndCollectFocus(messageId) -> Promise<string|null>`
- `showGenerationOverlay(message) -> void`
- `hideGenerationOverlay() -> void`

- [ ] 有内容时先确认；确认取消或重点要求取消都不清空。
- [ ] 提交重点要求后按顺序清空图位、描述和章节数据，再调用规划/生图。
- [ ] 清空失败停止并报错；不删除服务器旧图片文件。
- [ ] 任务绑定聊天和消息索引，关闭阅读器或切换楼层不改变目标。
- [ ] 生成开始显示全页面遮罩“正在生成中，请勿关闭页面”，遮罩期间页面不可点击；成功、失败和终止均移除。
- [ ] 测试取消、清空失败、重复点击、部分成功和任务绑定。

### Task 6: 集成验证与文档

**Files:**
- Modify: `docs/2026-10-12-1.2.0漫画阅读器需求.md`
- Create: `tests/fixtures/comic-reader-fixtures.json`

- [ ] 用三种模式 fixture 验证页面模型、章节缺失、历史版本、跨楼层导航。
- [ ] 运行项目 lint、相关单元测试和浏览器模拟验证。
- [ ] 手工记录真实酒馆验收边界：不调用真实 LLM/绘图模型，不修改酒馆源码。
- [ ] 更新需求文档的实现状态和已知限制，提交最终集成变更。

## 提交顺序

每个任务完成并通过自身测试后单独提交；最终运行完整相关测试和 lint，再做一次整体代码审查。
