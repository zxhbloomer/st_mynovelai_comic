import { parseImageBlock } from './comic-protocol.js';

export function createComicDraft(comic, image, planning) {
    const parsed = parseImageBlock(image);
    if (!parsed?.ok || parsed.wireFormat !== 'sections') throw new Error(parsed?.reason || '图片必须使用完整分段协议');
    return { ...comic, draft: { image, planning: String(planning || '') } };
}

export function comicForRedraw(comic) {
    const result = JSON.parse(JSON.stringify({ ...comic, ...(comic.draft || {}) }));
    delete result.draft;
    result.pages = (result.pages || []).map(page => page.page === result.page
        ? { ...page, image: result.image, planning: result.planning } : page);
    return result;
}
