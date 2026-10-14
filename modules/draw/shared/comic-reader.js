import { getAdjacentStoryFloor } from './comic-reader-model.js';

let lastReaderPosition = null;
let readerOpen = false;
export const isComicReaderOpen = () => readerOpen;
export const getLastReaderPosition = () => lastReaderPosition ? { ...lastReaderPosition } : null;

export const normalizeReaderIndex = (index, count) => Math.max(0, Math.min(Math.max(0, count - 1), Number(index) || 0));
export const getReaderPageTarget = ({ pageIndex, pageCount, floorIndex, floorCount, direction }) => {
    if (direction < 0 && pageIndex <= 0 && floorIndex > 0) return { type: 'floor', floorIndex: floorIndex - 1, pageIndex: -1 };
    if (direction > 0 && pageIndex >= pageCount - 1 && floorIndex < floorCount - 1) return { type: 'floor', floorIndex: floorIndex + 1, pageIndex: 0 };
    return { type: 'page', pageIndex: normalizeReaderIndex(pageIndex + (direction < 0 ? -1 : 1), pageCount) };
};

const styleText = `
.xb-comic-reader{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:0;box-sizing:border-box}
.xb-comic-reader-dialog{width:100%;height:100%;background:var(--SmartThemeBlurTintColor,#202020);color:var(--SmartThemeBodyColor,#eee);display:flex;flex-direction:column;border:0;border-radius:0;overflow:hidden;box-shadow:none}
.xb-comic-reader-head{position:relative;text-align:center;padding:14px 56px;border-bottom:1px solid rgba(255,255,255,.12);flex-shrink:0}
.xb-comic-reader-title{font-size:20px;font-weight:700}.xb-comic-reader-chapter{font-size:16px;margin-top:6px;overflow-wrap:anywhere}.xb-comic-reader-location{font-size:12px;opacity:.7;margin-top:4px}
.xb-comic-reader button{color:inherit;cursor:pointer;border:1px solid rgba(255,255,255,.2);background:rgba(127,127,127,.15)}
.xb-comic-reader button:hover{background:rgba(127,127,127,.3)}.xb-comic-reader :is(button,input):focus-visible{outline:2px solid var(--SmartThemeQuoteColor,#bbaadd);outline-offset:3px}
.xb-comic-reader-close{position:absolute;right:12px;top:12px;width:34px;height:34px;border-radius:50%;font-size:22px}
.xb-comic-reader-body{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:16px 64px;background:rgba(0,0,0,.15);overflow:hidden}
.xb-comic-reader-image{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;box-shadow:0 8px 30px #0008}
.xb-comic-reader-arrow{position:absolute;top:50%;transform:translateY(-50%);font-size:28px;width:42px;height:42px;border-radius:50%;z-index:1}.xb-comic-reader-arrow:first-child{left:12px}.xb-comic-reader-arrow:last-child{right:12px}
.xb-comic-reader-empty{text-align:center;padding:24px;border:1px dashed rgba(127,127,127,.4);border-radius:12px;font-size:16px}
.xb-comic-reader-generating::before{content:'';display:block;width:24px;height:24px;margin:0 auto 12px;border:2px solid rgba(127,127,127,.4);border-top-color:currentColor;border-radius:50%;animation:xb-reader-spin 1s linear infinite}
@keyframes xb-reader-spin{to{transform:rotate(360deg)}}
.xb-comic-reader-summary{margin:0 16px;padding:10px 14px;max-height:min(110px,20dvh);overflow:auto;flex-shrink:0;border:1px solid rgba(127,127,127,.25);border-radius:10px;background:rgba(127,127,127,.08);font-size:14px;line-height:1.6;overflow-wrap:anywhere}
.xb-comic-reader-summary-label{display:block;font-size:12px;font-weight:700;opacity:.7;margin-bottom:4px}.xb-comic-reader-summary-text{white-space:pre-wrap}.xb-comic-reader-summary.is-empty{opacity:.65}
.xb-comic-reader-meta{text-align:center;padding:8px;font-size:13px;opacity:.75;flex-shrink:0}
.xb-comic-reader-toolbar{display:flex;gap:8px;align-items:center;padding:12px 16px;border-top:1px solid rgba(127,127,127,.25);flex-shrink:0}.xb-comic-reader-toolbar button{min-height:36px;padding:6px 12px;border-radius:8px;white-space:nowrap}.xb-comic-reader-toolbar button:last-child{margin-left:auto;background:var(--SmartThemeQuoteColor,#bbaadd);color:#171717;font-weight:700}
.xb-comic-reader-floor{width:76px;min-height:36px;box-sizing:border-box;text-align:center;border:1px solid rgba(127,127,127,.4);border-radius:8px;background:rgba(127,127,127,.1);color:inherit}
@media(max-width:640px){.xb-comic-reader{padding:0}.xb-comic-reader-dialog{width:100%;height:100dvh;border-radius:0}.xb-comic-reader-body{padding:12px}.xb-comic-reader-arrow{background:rgba(0,0,0,.65)!important;color:#fff!important}.xb-comic-reader-summary{margin:0 10px}.xb-comic-reader-toolbar{flex-wrap:wrap;justify-content:center;padding:10px;gap:6px}.xb-comic-reader-toolbar button:last-child{flex-basis:100%;margin-left:0}.xb-comic-reader-toolbar button{padding:6px 8px}.xb-comic-reader-floor{width:58px}}
@media(prefers-reduced-motion:reduce){.xb-comic-reader-generating::before{animation:none}}
`;


export function createComicReader(options = {}) {
    const doc = options.document || globalThis.document;
    if (!doc?.body) throw new Error('阅读器需要浏览器文档');
    let overlay = null;
    let floors = [];
    let floorIndex = 0;
    let pageIndex = 0;
    let disposeChanges = null;
    let refreshing = false;
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
        title.textContent = '花漫画 · 阅读';
        overlay.querySelector('.xb-comic-reader-chapter').textContent = floor?.chapterTitle || '暂无标题';
        overlay.querySelector('.xb-comic-reader-location').textContent = `楼层：${floor?.messageId ?? ''}层`;
        body.replaceChildren();
        const prev = doc.createElement('button'); prev.className = 'xb-comic-reader-arrow'; prev.textContent = '‹'; prev.setAttribute('aria-label', '上一张'); prev.onclick = () => move(-1);
        const next = doc.createElement('button'); next.className = 'xb-comic-reader-arrow'; next.textContent = '›'; next.setAttribute('aria-label', '下一张'); next.onclick = () => move(1);
        body.append(prev);
        if (floor?.generating) { const generating = doc.createElement('div'); generating.className = 'xb-comic-reader-empty xb-comic-reader-generating'; generating.textContent = '正在生成中，请稍候…'; body.append(generating); }
        else if (floor?.pages?.length) { const image = doc.createElement('img'); image.className = 'xb-comic-reader-image'; image.src = floor.pages[pageIndex]?.url || ''; image.alt = `漫画第 ${pageIndex + 1} 张`; body.append(image); }
        else { const empty = doc.createElement('div'); empty.className = 'xb-comic-reader-empty'; empty.textContent = '本楼层暂无漫画'; body.append(empty); }
        body.append(next);
        const count = floor?.pages?.length || 0; meta.textContent = count ? `第 ${pageIndex + 1} 张 / 共 ${count} 张` : '暂无漫画 · 共 0 张';
        summary.querySelector('.xb-comic-reader-summary-text').textContent = floor?.summary && floor.summary !== '暂无简介' ? floor.summary : '暂无剧情简介';
        summary.classList.toggle('is-empty', !floor?.summary || floor.summary === '暂无简介');
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
    const onKey = event => { if (!overlay || event.target?.matches?.('input,textarea,select,button') || doc.querySelector('#xb-generation-overlay')) return; if (event.key === 'Escape') close(); else if (event.key === 'ArrowLeft') move(-1); else if (event.key === 'ArrowRight') move(1); else if (event.key === 'PageUp') { event.preventDefault(); moveFloor(-1); } else if (event.key === 'PageDown') { event.preventDefault(); moveFloor(1); } };
    async function refresh() {
        if (!overlay || refreshing) return;
        refreshing = true;
        try {
            const updated = await Promise.resolve(options.getFloors?.() || []);
            if (!overlay) return;
            if (!updated.length) { close(); return; }
            const changed = JSON.stringify(updated) !== JSON.stringify(floors);
            if (!changed) return;
            const previous = current();
            const slotId = previous?.pages?.[pageIndex]?.slotId;
            floors = updated;
            floorIndex = Math.max(0, floors.findIndex(floor => Number(floor.messageId) === Number(previous?.messageId)));
            const selectedIndex = current()?.pages?.findIndex(page => page.slotId === slotId) ?? -1;
            pageIndex = normalizeReaderIndex(selectedIndex >= 0 ? selectedIndex : pageIndex, current()?.pages?.length || 0);
            render();
        } catch (error) { options.onError?.(error.message || String(error)); }
        finally { refreshing = false; }
    }
    function close() { disposeChanges?.(); disposeChanges = null; doc.removeEventListener('keydown', onKey); overlay?.remove(); overlay = null; readerOpen = false; options.onClose?.(); }
    async function open() {
        ensureStyle(); floors = await Promise.resolve(options.getFloors?.() || []); if (!floors.length) throw new Error('没有可阅读的故事楼层');
        floorIndex = Math.max(0, floors.findIndex(floor => Number(floor.messageId) === Number(state.messageId))); if (floorIndex < 0) floorIndex = 0; pageIndex = normalizeReaderIndex(options.initialPageIndex ?? 0, floors[floorIndex]?.pages?.length || 0);
        overlay = doc.createElement('div'); overlay.className = 'xb-comic-reader';
        const dialog = doc.createElement('div'); dialog.className = 'xb-comic-reader-dialog'; overlay.append(dialog);
        const head = doc.createElement('div'); head.className = 'xb-comic-reader-head'; const title = doc.createElement('div'); title.className = 'xb-comic-reader-title'; head.append(title); const chapter = doc.createElement('div'); chapter.className = 'xb-comic-reader-chapter'; head.append(chapter); const location = doc.createElement('div'); location.className = 'xb-comic-reader-location'; head.append(location); const closeButton = doc.createElement('button'); closeButton.className = 'xb-comic-reader-close'; closeButton.textContent = '×'; closeButton.setAttribute('aria-label', '关闭阅读器'); closeButton.onclick = close; head.append(closeButton); dialog.append(head);
        const body = doc.createElement('div'); body.className = 'xb-comic-reader-body'; dialog.append(body); const summary = doc.createElement('div'); summary.className = 'xb-comic-reader-summary'; const label = doc.createElement('span'); label.className = 'xb-comic-reader-summary-label'; label.textContent = '剧情简介'; summary.append(label); const summaryText = doc.createElement('span'); summaryText.className = 'xb-comic-reader-summary-text'; summary.append(summaryText); dialog.append(summary); const meta = doc.createElement('div'); meta.className = 'xb-comic-reader-meta'; dialog.append(meta);
        const toolbar = doc.createElement('div'); toolbar.className = 'xb-comic-reader-toolbar'; const prevFloor = doc.createElement('button'); prevFloor.textContent = '上一故事楼层'; prevFloor.onclick = () => moveFloor(-1); const input = doc.createElement('input'); input.className = 'xb-comic-reader-floor'; input.title = '跳转故事楼层'; const jump = doc.createElement('button'); jump.textContent = '跳转'; jump.onclick = () => { const i = floors.findIndex(f => String(f.messageId) === input.value.trim()); if (i >= 0) selectFloor(i); else options.onError?.('找不到故事楼层'); }; const nextFloor = doc.createElement('button'); nextFloor.textContent = '下一故事楼层'; nextFloor.onclick = () => moveFloor(1); const draw = doc.createElement('button'); draw.textContent = '花漫画'; draw.onclick = () => options.onRegenerate?.(current()?.messageId); toolbar.append(prevFloor, input, jump, nextFloor, draw); dialog.append(toolbar);
        doc.body.append(overlay); readerOpen = true; doc.addEventListener('keydown', onKey); render();
        disposeChanges = options.subscribeChanges?.(() => void refresh()) || null;
    }
    return { open, close, refresh, move };
}

export async function openComicReader(options) { return createComicReader(options).open(); }





