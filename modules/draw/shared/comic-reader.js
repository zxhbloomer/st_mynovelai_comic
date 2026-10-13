import { getAdjacentStoryFloor } from './comic-reader-model.js';

let lastReaderPosition = null;
export const getLastReaderPosition = () => lastReaderPosition ? { ...lastReaderPosition } : null;

export const normalizeReaderIndex = (index, count) => Math.max(0, Math.min(Math.max(0, count - 1), Number(index) || 0));
export const getReaderPageTarget = ({ pageIndex, pageCount, floorIndex, floorCount, direction }) => {
    if (direction < 0 && pageIndex <= 0 && floorIndex > 0) return { type: 'floor', floorIndex: floorIndex - 1, pageIndex: -1 };
    if (direction > 0 && pageIndex >= pageCount - 1 && floorIndex < floorCount - 1) return { type: 'floor', floorIndex: floorIndex + 1, pageIndex: 0 };
    return { type: 'page', pageIndex: normalizeReaderIndex(pageIndex + (direction < 0 ? -1 : 1), pageCount) };
};

const styleText = `.xb-comic-reader{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center}.xb-comic-reader-dialog{width:min(96vw,1100px);height:min(94vh,900px);background:var(--SmartThemeBlurTintColor,#202020);color:var(--SmartThemeBodyColor,#eee);display:flex;flex-direction:column;border-radius:8px;overflow:hidden}.xb-comic-reader-head{position:relative;text-align:center;padding:12px 56px 8px;font-size:18px}.xb-comic-reader-close{position:absolute;right:12px;top:8px}.xb-comic-reader-body{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 20px}.xb-comic-reader-image{max-width:calc(100% - 90px);max-height:100%;object-fit:contain}.xb-comic-reader-empty{opacity:.8;text-align:center}.xb-comic-reader-arrow{font-size:28px;min-width:38px}.xb-comic-reader-meta{text-align:center;padding:8px}.xb-comic-reader-summary{padding:8px 18px;max-height:100px;overflow:auto}.xb-comic-reader-toolbar{display:flex;gap:6px;align-items:center;justify-content:center;padding:8px;border-top:1px solid rgba(255,255,255,.15)}.xb-comic-reader-floor{width:80px}`;

export function createComicReader(options = {}) {
    const doc = options.document || globalThis.document;
    if (!doc?.body) throw new Error('阅读器需要浏览器文档');
    let overlay = null;
    let floors = [];
    let floorIndex = 0;
    let pageIndex = 0;
    const state = { chatId: options.chatId || '', messageId: options.messageId };
    const ensureStyle = () => { if (doc.getElementById('xb-comic-reader-style')) return; const style = doc.createElement('style'); style.id = 'xb-comic-reader-style'; style.textContent = styleText; doc.head?.append(style); };
    const current = () => floors[floorIndex];
    const render = () => {
        if (!overlay) return;
        const floor = current();
        const title = overlay.querySelector('.xb-comic-reader-title');
        const body = overlay.querySelector('.xb-comic-reader-body');
        const meta = overlay.querySelector('.xb-comic-reader-meta');
        const summary = overlay.querySelector('.xb-comic-reader-summary');
        const floorInput = overlay.querySelector('.xb-comic-reader-floor');
        title.textContent = `花漫画-阅读  章节：${floor?.chapterTitle || '暂无标题'}  楼层：${floor?.messageId ?? ''}层`;
        body.replaceChildren();
        const prev = doc.createElement('button'); prev.className = 'xb-comic-reader-arrow'; prev.textContent = '‹'; prev.onclick = () => move(-1);
        const next = doc.createElement('button'); next.className = 'xb-comic-reader-arrow'; next.textContent = '›'; next.onclick = () => move(1);
        body.append(prev);
        if (floor?.pages?.length) { const image = doc.createElement('img'); image.className = 'xb-comic-reader-image'; image.src = floor.pages[pageIndex]?.url || ''; image.alt = `漫画第 ${pageIndex + 1} 张`; body.append(image); }
        else { const empty = doc.createElement('div'); empty.className = 'xb-comic-reader-empty'; empty.textContent = '本楼层暂无漫画'; body.append(empty); }
        body.append(next);
        const count = floor?.pages?.length || 0; meta.textContent = count ? `当前 ${pageIndex + 1} 张漫画，共 ${count} 张漫画` : '当前 0 张漫画，共 0 张漫画';
        summary.textContent = `简单的剧情：${floor?.summary || '暂无简介'}`;
        floorInput.value = floor?.messageId ?? '';
        lastReaderPosition = { chatId: state.chatId, messageId: floor?.messageId, pageIndex }; options.onStateChange?.(state, floor, pageIndex);
    };
    const selectFloor = index => { if (!floors[index]) return; floorIndex = index; pageIndex = 0; render(); };
    const moveFloor = direction => { const target = getAdjacentStoryFloor(floors, current()?.messageId, direction); if (target) selectFloor(floors.indexOf(target)); };
    function move(direction) {
        const floor = current(); const count = floor?.pages?.length || 0;
        if (!count) { moveFloor(direction); return; }
        const target = getReaderPageTarget({ pageIndex, pageCount: count, floorIndex, floorCount: floors.length, direction });
        if (target.type === 'floor') { floorIndex = target.floorIndex; pageIndex = target.pageIndex < 0 ? Math.max(0, (floors[floorIndex]?.pages?.length || 1) - 1) : 0; }
        else pageIndex = target.pageIndex;
        render();
    }
    const onKey = event => { if (!overlay || event.target?.matches?.('input,textarea,select,button')) return; if (event.key === 'Escape') close(); else if (event.key === 'ArrowLeft') move(-1); else if (event.key === 'ArrowRight') move(1); else if (event.key === 'PageUp') { event.preventDefault(); moveFloor(-1); } else if (event.key === 'PageDown') { event.preventDefault(); moveFloor(1); } };
    function close() { doc.removeEventListener('keydown', onKey); overlay?.remove(); overlay = null; options.onClose?.(); }
    async function open() {
        ensureStyle(); floors = await Promise.resolve(options.getFloors?.() || []); if (!floors.length) throw new Error('没有可阅读的故事楼层');
        floorIndex = Math.max(0, floors.findIndex(floor => Number(floor.messageId) === Number(state.messageId))); if (floorIndex < 0) floorIndex = 0; pageIndex = 0;
        overlay = doc.createElement('div'); overlay.className = 'xb-comic-reader';
        const dialog = doc.createElement('div'); dialog.className = 'xb-comic-reader-dialog'; overlay.append(dialog);
        const head = doc.createElement('div'); head.className = 'xb-comic-reader-head'; const title = doc.createElement('div'); title.className = 'xb-comic-reader-title'; head.append(title); const closeButton = doc.createElement('button'); closeButton.className = 'xb-comic-reader-close'; closeButton.textContent = '×'; closeButton.onclick = close; head.append(closeButton); dialog.append(head);
        const body = doc.createElement('div'); body.className = 'xb-comic-reader-body'; dialog.append(body); const summary = doc.createElement('div'); summary.className = 'xb-comic-reader-summary'; dialog.append(summary); const meta = doc.createElement('div'); meta.className = 'xb-comic-reader-meta'; dialog.append(meta);
        const toolbar = doc.createElement('div'); toolbar.className = 'xb-comic-reader-toolbar'; const prevFloor = doc.createElement('button'); prevFloor.textContent = '上一故事楼层'; prevFloor.onclick = () => moveFloor(-1); const input = doc.createElement('input'); input.className = 'xb-comic-reader-floor'; input.title = '跳转故事楼层'; const jump = doc.createElement('button'); jump.textContent = '跳转'; jump.onclick = () => { const i = floors.findIndex(f => String(f.messageId) === input.value.trim()); if (i >= 0) selectFloor(i); else options.onError?.('找不到故事楼层'); }; const nextFloor = doc.createElement('button'); nextFloor.textContent = '下一故事楼层'; nextFloor.onclick = () => moveFloor(1); const draw = doc.createElement('button'); draw.textContent = '花漫画'; draw.onclick = () => options.onRegenerate?.(current()?.messageId); toolbar.append(prevFloor, input, jump, nextFloor, draw); dialog.append(toolbar);
        doc.body.append(overlay); doc.addEventListener('keydown', onKey); render();
    }
    return { open, close, refresh: render, move };
}

export async function openComicReader(options) { return createComicReader(options).open(); }

