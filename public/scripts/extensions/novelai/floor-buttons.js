let observer;
function addFloorButton(messageElement) {
    if (messageElement.querySelector('.novelai-floor-button')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'novelai-floor-button menu_button';
    button.textContent = 'NovelAI';
    button.title = '根据此楼层生成图片';
    button.addEventListener('click', async () => {
        const text = messageElement.querySelector('.mes_text')?.textContent?.trim() || '';
        button.disabled = true;
        try { await window.stNovelAI?.generateAndInsertNovelAIImage({ scene: text, caption: 'NovelAI image' }); button.textContent = '已生成'; }
        catch (error) { console.error('[NovelAI] floor generation failed', error); button.textContent = '失败'; }
        finally { setTimeout(() => { button.textContent = 'NovelAI'; button.disabled = false; }, 2500); }
    });
    (messageElement.querySelector('.mes_buttons') || messageElement).append(button);
}
export function initNovelAIFloorButtons() {
    document.querySelectorAll('.mes').forEach(addFloorButton);
    observer = new MutationObserver(() => document.querySelectorAll('.mes').forEach(addFloorButton));
    observer.observe(document.body, { childList: true, subtree: true });
}
export function destroyNovelAIFloorButtons() { observer?.disconnect(); observer = undefined; document.querySelectorAll('.novelai-floor-button').forEach(button => button.remove()); }
