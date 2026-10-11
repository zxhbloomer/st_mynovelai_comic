import { createMangaGeneration } from './comic-generation.js';
import { comicRules } from './comic-rules.js';
import { parseImageBlock } from './comic-protocol.js';
import { hashSceneSource } from './scene-source.js';
import { stripDrawImageSlots } from './image-marker-syntax.js';

export function normalizeComicMode(mode) {
    return ['inline', 'end'].includes(mode) ? mode : 'points';
}

// Reference setvar/getvar/comment macros reset locally per request.
export function compileComicRules(maxImages = 0) {
    const variables = new Map();
    const substitute = text => String(text).replace(/\{\{([\s\S]*?)\}\}/g, (match, body) => {
        if (body.trim().startsWith('//')) return '';
        const [command, key, ...values] = body.split('::');
        if (command.trim() === 'setvar') { variables.set(key.trim(), values.join('::')); return ''; }
        if (command.trim() === 'getvar') return variables.get(key.trim()) || '';
        throw new Error(`漫画规则包含不支持的宏：${command}`);
    });
    return comicRules.filter(row => row.id === 'pages_auto' ? maxImages !== 1
        : row.id === 'pages_1' ? maxImages === 1
            : row.enabled && !/丨(?:预填充|画风|画师串)-/.test(row.name))
        .map(row => ({ role: row.role, content: substitute(row.content).trim() }))
        .filter(row => row.content);
}

export function createComicSnapshot(source, mode) {
    const snapshot = createMangaGeneration().snapshotTarget([{ id: 0, role: 'assistant', text: stripDrawImageSlots(source) }], 0, 0);
    if (mode === 'inline' && !snapshot.inlineSafe) throw new Error('正文无法安全按段落定位，请选择文章末尾');
    return snapshot;
}

export function buildComicMessages({ source, mode, maxImages = 0, opening = '', guide = '', rules = '', worldInfo = '' }) {
    const snapshot = createComicSnapshot(source, mode);
    const placement = mode === 'inline'
        ? '每页在 image 块紧前输出 <manga_position>段落编号</manga_position>，例如 <manga_position>1</manga_position>；编号在给定范围内且非递减。位置标记在 image 外。'
        : '图片全部放在文章最后，不输出 manga_position 标记。';
    return [...(opening ? [{ role: 'system', content: opening }] : []), ...compileComicRules(maxImages), {
        role: 'system', content: `[MANGA_INDEPENDENT_V1]\n本次执行漫画转译，不续写或重写故事正文。只呈现目标正文事件，世界书仅用于参考。可先输出闭合的 thinking，随后按页序输出闭合的 comic_plan 与完整 image。必须完成实际图片描述，不能只输出规划。image 内保持完整 @page、@panel、@character 分段协议，不输出 JSON 或代码围栏。${placement}${maxImages > 0 ? `最多输出 ${maxImages} 个完整 image 块。` : ''}\n当前绘图模型指南：\n${guide}\n用户场景要求：\n${rules}\n本次只返回完整漫画文本协议，不调用 submit_scene_plan；模板中针对插图点或工具字段的要求仅适用模式①。`,
    }, { role: 'user', content: `${worldInfo ? `<world_info>\n${worldInfo}\n</world_info>\n` : ''}<source_text>\n${snapshot.body}\n</source_text>\n段落定位表（不属于绘图描述）：\n${snapshot.paragraphs.map(p => `[段落 ${p.id}] ${p.content}`).join('\n\n')}` }];
}

export function createComicTasks({ source, response, mode, maxImages = 0 }) {
    if (!['inline', 'end'].includes(mode)) throw new Error('漫画生成模式无效');
    const snapshot = createComicSnapshot(source, mode);
    const plan = createMangaGeneration().validateComicPlan(response, { placement: mode, paragraphCount: snapshot.paragraphs.length });
    if (maxImages > 0 && plan.pages.length > maxImages) throw new Error('返回图片数量超过当前上限');
    const planning = [...response.matchAll(/<comic_plan\b[^>]*>([\s\S]*?)<\/comic_plan>/gi)].map(m => m[1].trim());
    const thinking = [...response.matchAll(/<thinking\b[^>]*>([\s\S]*?)<\/thinking>/gi)].map(m => m[1].trim()).join('\n\n');
    const pages = plan.pages.map(page => ({ page: page.page, image: page.image.slice(7, -8).trim(),
        planning: planning.length === plan.pages.length ? planning[page.page - 1] : '' }));
    const placementSource = stripDrawImageSlots(source);
    const sourceHash = hashSceneSource(placementSource);
    const trimOffset = placementSource.indexOf(snapshot.body);
    if (mode === 'inline' && trimOffset < 0) throw new Error('正文包含需要清理的非连续描述块，无法安全定位，请选择文章末尾');
    return plan.pages.map((page, index) => {
        const parsed = parseImageBlock(pages[index].image);
        if (!parsed?.ok || parsed.wireFormat !== 'sections') throw new Error(parsed?.reason || '图片必须使用完整分段文本协议');
        return { scene: pages[index].image, comic: { version: 1, mode, page: page.page,
            image: pages[index].image, planning: pages[index].planning,
            sourceText: snapshot.body, roundPlanning: planning.join('\n\n'), thinking, pages,
            afterParagraph: page.afterParagraph },
            placement: { mode: 'source', sourceHash, offset: mode === 'inline'
                ? trimOffset + snapshot.paragraphs[page.afterParagraph - 1].end : placementSource.length } };
    });
}

export function compileComicPrompt(comic, recipe = {}) {
    const parsed = parseImageBlock(comic.image);
    if (!parsed?.ok) throw new Error(parsed?.reason || '完整图片描述无效');
    return { scene: [recipe.positivePrefix, parsed.base.prompt].filter(Boolean).join(', '),
        negativePrompt: String(recipe.negativePrefix || ''),
        characterPrompts: parsed.characters.map(c => ({ prompt: c.positive, uc: c.negative, center: c.center })),
        useCoords: parsed.positionMode === 'manual' };
}
