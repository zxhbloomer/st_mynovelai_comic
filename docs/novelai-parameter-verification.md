# NovelAI 参数核对

核对日期：2026-10-10。

官方依据：
- https://docs.novelai.net/en/image/stepsguidance
- https://docs.novelai.net/en/image/sampling
- https://docs.novelai.net/en/image/seed

公开集成参考（不是官方 API 合约）：https://comfy.icu/node/NovelAI 。该页面列出 `k_dpmpp_2s_ancestral` 和 `k_dpmpp_2m_sde`。

| 界面名称 | 本项目请求字段 | 含义 |
| --- | --- | --- |
| Steps | steps | 采样步数 |
| Prompt Guidance（原 CFG） | scale | 提示词引导强度 |
| Prompt Guidance Rescale（原 CFG 重缩放） | cfg_rescale | 引导重缩放，范围 0～1 |
| Seed | seed | 随机种子；本项目 -1 表示随机，由请求流程生成实际种子 |

官方说明中，引导重缩放用于缓解高引导强度带来的过度饱和。固定种子有助于比较参数效果，但不保证所有采样器都能完全复现。

本次按用户截图调整采样器列表顺序并补充两项；保留已有 DDIM 映射和自定义选项。修改标签和 Guidance 小数步长，不改变已有配置值。

验证：核心 smoke 测试、git diff --check 通过。尚未验证真实浏览器显示及第三方接口对新增采样器、当前模型的接受情况；本次没有调用付费生图接口。
