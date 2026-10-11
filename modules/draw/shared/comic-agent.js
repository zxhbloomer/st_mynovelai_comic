import { resolveDrawAgentContext } from './draw-agent.js';
import { appendDrawLog } from './scene-planner-debug.js';
import { compileComicRules } from './comic-planning.js';
import { parseRerollResponse } from './comic-protocol.js';

export async function callComicText(messages, { signal, timeout = 120000, context, operation = '生成描述' } = {}) {
    signal?.throwIfAborted();
    const requestId = `comic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const startedAt = Date.now();
    appendDrawLog('②③ LLM · 读取设置', { requestId, operation });
    let agentCore, providerConfig;
    try {
        ({ agentCore, providerConfig } = context || await resolveDrawAgentContext({ timeout }));
    } catch (error) {
        appendDrawLog('②③ LLM · 设置读取失败', { requestId, error: error.message }, 'error');
        throw error;
    }
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(() => controller.abort(new Error('图片描述生成超时')), timeout);
    try {
        const adapter = agentCore.createAgentAdapter(providerConfig);
        appendDrawLog('②③ LLM · 开始请求', { requestId, operation, preset: providerConfig.currentPresetName,
            provider: providerConfig.provider, model: providerConfig.model, messages });
        const result = await adapter.chat({ messages, tools: [], temperature: providerConfig.temperature,
            maxTokens: providerConfig.maxTokens, reasoning: providerConfig.reasoning, signal: controller.signal });
        controller.signal.throwIfAborted();
        if (!String(result?.text || '').trim()) throw new Error('LLM 未返回完整图片描述');
        appendDrawLog('②③ LLM · 请求完成', { requestId, durationMs: Date.now() - startedAt, response: result.text });
        return result.text;
    } catch (error) {
        appendDrawLog('②③ LLM · 请求失败', { requestId, durationMs: Date.now() - startedAt,
            error: error.message, aborted: controller.signal.aborted }, 'error');
        throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

function detectComicMessageMode() { return 'new'; }
function buildPageRerollReference(comic, pageNo, currentPlanning, currentImage) {
    const pages = comic.pages || [{ page: pageNo, image: comic.image, planning: comic.planning }];
    if (!comic.roundPlanning && !comic.sourceText) throw new Error('图片记录缺少规划或正文参考，无法 AI 改写');
    const roundTag = comic.roundPlanning ? 'comic_plan' : 'source_text';
    return `<comic_reroll_reference readonly="true">\n${comic.thinking ? `<thinking>\n${comic.thinking}\n</thinking>\n` : ''}<${roundTag}>\n${comic.roundPlanning || comic.sourceText}\n</${roundTag}>\n\n${pages.map(page => {
        const target = page.page === pageNo;
        return `<page_reference page="${page.page}">\n<comic_plan>\n${target ? currentPlanning : page.planning || ''}\n</comic_plan>\n<image>\n${target ? currentImage : page.image}\n</image>\n</page_reference>`;
    }).join('\n\n')}\n</comic_reroll_reference>`;
}

  function buildPageRerollRequest(pageNo, sourceMessage, currentPlanning, currentImage, customRequirement) {
    var pNo = Number(pageNo), mode = detectComicMessageMode(sourceMessage);
    var requirement = String(customRequirement || "").trim() || "保持人物、衣着、场景和剧情连续，优化目标页的分镜构图与提示词。";
    var tag = mode === "new" ? "comic_plan" : "thinking";
    var identity = mode === "new" ? "角色DNA" : "角色母表";
    return { mode: mode, reference: buildPageRerollReference(sourceMessage, pNo, currentPlanning, currentImage), userPrompt:
      "你正在执行单页漫画重roll。只读参考资料已放入聊天历史，不得复述、改写或输出其他页面与整轮规划。\n" +
      "只重写第 " + pNo + " 页：必须且只能输出一组 <" + tag + ">...</" + tag + "> 和一组 <image>...</image>。\n" +
      "<image> 使用 v1.2 分段文本协议：@page 后按 @panel 编号、@character 编号组织；人物正面词接在人物标记后，独立负面词用 @negative，页面或画格非人物内容用 @non_character；无人物的格只写画格段。自动定位省略坐标，手动定位在 @page 前写 @position manual，并为每个人物写 @center x,y。不要输出 JSON。\n" +
      "沿用只读参考中的" + identity + "、已生效外观变化、画风、色彩、对白语言及连续状态。可见人物必须在其所属画格独立写出本镜头可见的完整外观及衣着，不得用编号或前格代替。\n" +
      "用户对第 " + pNo + " 页的要求：" + requirement };
  }


export async function rewriteComic(comic, requirement, options = {}) {
    const request = buildPageRerollRequest(comic.page, comic, comic.planning, comic.image, requirement);
    const rules = comic.ruleMessages || compileComicRules(0);
    const response = await callComicText([...rules,
        ...(comic.guide ? [{ role: 'system', content: comic.guide }] : []),
        ...(comic.worldInfo ? [{ role: 'system', content: comic.worldInfo }] : []),
        { role: 'user', content: request.reference }, { role: 'user', content: request.userPrompt }], { ...options, operation: 'AI 改写' });
    const parsed = parseRerollResponse(response, request.mode);
    if (!parsed.ok) throw new Error(parsed.error);
    return { ...comic, image: parsed.image, planning: parsed.planning };
}
