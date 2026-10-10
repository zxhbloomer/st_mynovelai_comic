const POSITION_KEY = 'st_mynovelai_float_position';
let floatingButton;
let busy = false;

function getPosition() {
    try { return JSON.parse(localStorage.getItem(POSITION_KEY) || '{}'); } catch { return {}; }
}

function setStatus(text, state = '') {
    if (!floatingButton) return;
    floatingButton.textContent = text;
    floatingButton.dataset.state = state;
}

async function generateFromLastMessage() {
    if (busy || !window.stNovelAI?.generateAndInsertNovelAIImage) return;
    busy = true;
    setStatus('生成中…', 'busy');
    try {
        const input = document.querySelector('#send_textarea')?.value?.trim() || '1girl, smile, simple background';
        await window.stNovelAI.generateAndInsertNovelAIImage({ scene: input, caption: 'NovelAI image' });
        setStatus('NovelAI ✓', 'success');
    } catch (error) {
        console.error('[NovelAI] generation failed', error);
        setStatus('失败', 'error');
    } finally {
        busy = false;
        setTimeout(() => setStatus('NovelAI', ''), 3000);
    }
}

export function initNovelAIFloatingButton() {
    if (floatingButton) return;
    floatingButton = document.createElement('button');
    floatingButton.type = 'button';
    floatingButton.className = 'novelai-floating-button';
    floatingButton.textContent = 'NovelAI';
    floatingButton.title = '使用 NovelAI 生成图片';
    floatingButton.addEventListener('click', generateFromLastMessage);
    const position = getPosition();
    floatingButton.style.right = `${Number(position.right) || 24}px`;
    floatingButton.style.bottom = `${Number(position.bottom) || 88}px`;
    document.body.append(floatingButton);
}

export function destroyNovelAIFloatingButton() {
    floatingButton?.remove();
    floatingButton = undefined;
}
