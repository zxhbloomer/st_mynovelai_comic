const isNarrator = message => String(message?.extra?.type || '').toLowerCase() === 'narrator';
const isStoryMessage = message => {
    if (!message || message.is_user || message.is_system || message.hidden || isNarrator(message)) return false;
    const text = String(message.mes ?? message.text ?? '').trim();
    return Boolean(text);
};
const slotNumber = slotId => Number.parseInt(String(slotId).match(/(\d+)(?!.*\d)/)?.[1] || '', 10);
const savedEntries = message => {
    const maps = [message?.extra?.xiaobaixDrawSaved, message?.extra?.novelDrawSaved];
    const map = maps.find(value => value && typeof value === 'object') || {};
    return Object.entries(map).map(([slotId, entry]) => ({ slotId, entry })).filter(({ entry }) => entry?.savedUrl)
        .sort((a, b) => (slotNumber(a.slotId) || 0) - (slotNumber(b.slotId) || 0));
};
export function getStoryFloors(chat = []) {
    return chat.map((message, messageId) => isStoryMessage(message) ? { messageId, message } : null).filter(Boolean);
}
export function buildReaderFloor(message, mode = 'points', savedState = null, previewEntries = null) {
    const entries = previewEntries ? previewEntries.map(entry => ({ slotId: entry.slotId, entry })) : savedEntries(message);
    const pages = entries.map(({ slotId, entry }, index) => ({
        index,
        slotId,
        url: entry.savedUrl,
        imgId: entry.imgId || '',
        description: entry.comic?.image || entry.positive || '',
        mode: entry.comic?.mode || mode,
    }));
    const text = String(message?.mes ?? message?.text ?? '');
    const tagValue = name => text.match(new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)</' + name + '>', 'i'))?.[1]?.trim() || '';
    const title = String(savedState?.title || message?.extra?.xiaobaixComicTitle || tagValue('chapter_title')).trim() || '暂无标题';
    const summary = String(savedState?.summary || message?.extra?.xiaobaixComicSummary || tagValue('chapter_summary')).trim() || '暂无简介';
    return { messageId: savedState?.messageId ?? null, chapterTitle: title, summary, pages, hasComic: pages.length > 0 };
}
export function getAdjacentStoryFloor(floors, messageId, direction) {
    const index = floors.findIndex(floor => Number(floor.messageId) === Number(messageId));
    if (index < 0) return null;
    return floors[index + (direction < 0 ? -1 : 1)] || null;
}
export { isStoryMessage };


