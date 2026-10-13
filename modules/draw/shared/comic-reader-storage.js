export const READER_STATE_VERSION = 1;
const clone = value => JSON.parse(JSON.stringify(value));
export const normalizeReaderState = (value, chatId = value?.chatId) => {
    const source = value && typeof value === 'object' ? value : {};
    const floors = source.floors && typeof source.floors === 'object' && !Array.isArray(source.floors) ? source.floors : {};
    const normalizedFloors = Object.fromEntries(Object.entries(floors).map(([id, floor]) => [String(id), {
        title: typeof floor?.title === 'string' ? floor.title : '',
        summary: typeof floor?.summary === 'string' ? floor.summary : '',
        pageIndex: Math.max(0, Number.parseInt(floor?.pageIndex, 10) || 0),
    }]));
    return { version: READER_STATE_VERSION, chatId: String(chatId ?? source.chatId ?? ''), floors: normalizedFloors, lastFloorId: source.lastFloorId == null ? null : String(source.lastFloorId) };
};
export const createReaderStateStore = storage => {
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') throw new TypeError('阅读器存储需要 get/set 接口');
    const keyFor = chatId => `chat:${String(chatId)}`;
    return {
        async load(chatId) { const value = await storage.get(keyFor(chatId), null); return value ? normalizeReaderState(value, chatId) : null; },
        async save(chatId, state) { const normalized = normalizeReaderState(state, chatId); await storage.set(keyFor(chatId), clone(normalized)); return normalized; },
        async clear(chatId) { if (typeof storage.delete === 'function') await storage.delete(keyFor(chatId)); else await storage.set(keyFor(chatId), null); },
    };
};
