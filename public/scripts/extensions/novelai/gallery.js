import { listPreviews, deletePreview } from './storage/preview-cache.js';
export async function openNovelAIGallery() {
    const items = await listPreviews();
    const overlay = document.createElement('div'); overlay.className = 'novelai-gallery-overlay';
    const close = document.createElement('button'); close.textContent = '关闭'; close.onclick = () => overlay.remove(); overlay.append(close);
    const grid = document.createElement('div'); grid.className = 'novelai-gallery-grid'; overlay.append(grid);
    for (const item of items) { const card = document.createElement('figure'); const image = document.createElement('img'); image.src = `data:${item.mime || 'image/png'};base64,${item.base64}`; image.alt = item.scene || 'NovelAI preview'; const remove = document.createElement('button'); remove.textContent = '删除'; remove.onclick = async () => { await deletePreview(item.id); card.remove(); }; card.append(image, remove); grid.append(card); }
    document.body.append(overlay);
}
