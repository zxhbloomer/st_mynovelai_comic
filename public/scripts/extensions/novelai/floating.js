const POSITION_KEY = 'st_mynovelai_float_position';
let floatingButton;
let busy = false;
let dragging = false;
let expanded = false;

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
    floatingButton.textContent = '花漫画';
    floatingButton.title = '打开花漫画控制面板';
    floatingButton.addEventListener('click', () => { if (!dragging) { expanded = !expanded; renderFloatingPanel(); } });
    floatingButton.addEventListener('pointerdown', event => { dragging = false; const startX = event.clientX; const startY = event.clientY; const rect = floatingButton.getBoundingClientRect(); const move = moveEvent => { const dx = moveEvent.clientX - startX; const dy = moveEvent.clientY - startY; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragging = true; floatingButton.style.left = `${Math.max(0, rect.left + dx)}px`; floatingButton.style.top = `${Math.max(0, rect.top + dy)}px`; floatingButton.style.right = 'auto'; floatingButton.style.bottom = 'auto'; }; const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); const current = floatingButton.getBoundingClientRect(); localStorage.setItem(POSITION_KEY, JSON.stringify({ left: current.left, top: current.top })); }; document.addEventListener('pointermove', move); document.addEventListener('pointerup', up, { once: true }); });
    const position = getPosition();
    if (Number.isFinite(Number(position.left)) && Number.isFinite(Number(position.top))) {
        floatingButton.style.left = `${Number(position.left)}px`;
        floatingButton.style.top = `${Number(position.top)}px`;
    } else {
        floatingButton.style.right = `${Number(position.right) || 24}px`;
        floatingButton.style.bottom = `${Number(position.bottom) || 88}px`;
    }
    document.body.append(floatingButton);
}

function renderFloatingPanel() {
    document.querySelector('.novelai-floating-panel')?.remove();
    if (!expanded) return;
    const panel = document.createElement('div'); panel.className = 'novelai-floating-panel';
    panel.innerHTML = '<label>预设<select data-nai-float="preset"><option>配置-3</option></select></label><label>尺寸<select data-nai-float="size"><option>跟随预设</option></select></label><button type="button" data-nai-float="auto">● 自动配图</button><button type="button" data-nai-float="settings">⚙</button>';
    document.body.append(panel);
    const rect = floatingButton.getBoundingClientRect(); panel.style.left = `${Math.max(8, rect.left - 116)}px`; panel.style.top = `${Math.max(8, rect.top - 160)}px`;
    panel.querySelector('[data-nai-float=settings]').onclick = () => document.querySelector('[data-nai-action=settings]')?.click();
    panel.querySelector('[data-nai-float=auto]').onclick = () => { const enabled = panel.dataset.auto !== 'true'; panel.dataset.auto = String(enabled); panel.querySelector('[data-nai-float=auto]').textContent = enabled ? '● 自动配图' : '○ 自动配图'; };
}

export function destroyNovelAIFloatingButton() {
    expanded = false;
    document.querySelector('.novelai-floating-panel')?.remove();
    floatingButton?.remove();
    floatingButton = undefined;
}
