import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';
import { extensionFolderPath } from './core/constants.js';

const EXT_ID = 'HuaManhua';
let settingsRoot = null;
let sourceModulePromise = null;

function loadSourceModule() {
    sourceModulePromise ||= import('./modules/draw/providers/novelai/novel-draw.js');
    return sourceModulePromise;
}

async function mountSettings() {
    const host = document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings');
    if (!host || document.getElementById('huamanhua-settings')) return;
    let settingsHtml;
    const context = globalThis.SillyTavern?.getContext?.();
    if (typeof context?.renderExtensionTemplateAsync === 'function') {
        settingsHtml = await context.renderExtensionTemplateAsync('third-party/st_mynovelai_comic', 'settings');
    } else {
        const response = await fetch(`${extensionFolderPath}/settings.html`, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`花漫画设置加载失败（HTTP ${response.status}）`);
        settingsHtml = await response.text();
    }
    const wrapper = document.createElement('div');
    wrapper.id = 'huamanhua-settings';
    wrapper.innerHTML = settingsHtml;
    host.append(wrapper);
    settingsRoot = wrapper;
    const enabled = wrapper.querySelector('#huamanhua_enabled');
    if (!enabled) throw new Error('花漫画设置控件缺失');
    enabled.checked = extension_settings[EXT_ID].enabled === true;
    enabled.addEventListener('change', async () => {
        extension_settings[EXT_ID].enabled = enabled.checked;
        saveSettingsDebounced();
        const source = await loadSourceModule();
        if (enabled.checked) {
            window.isXiaobaixEnabled = true;
            await source.initNovelDraw();
        } else {
            await source.cleanupNovelDraw();
            window.isXiaobaixEnabled = false;
        }
    });
}

export async function initNovelDraw() {
    extension_settings[EXT_ID] ||= { enabled: false };
    for (let i = 0; i < 400 && !document.querySelector('#extensions_settings2, #extensions_settings'); i += 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    await mountSettings();
    window.isXiaobaixEnabled = extension_settings[EXT_ID].enabled === true;
    if (!window.isXiaobaixEnabled) return false;
    const source = await loadSourceModule();
    return await source.initNovelDraw();
}

export async function cleanup() {
    if (sourceModulePromise) {
        const source = await sourceModulePromise;
        await source.cleanupNovelDraw();
    }
    settingsRoot?.remove();
    settingsRoot = null;
}

void initNovelDraw().catch(error => console.error('[花漫画] 设置加载失败:', error));
