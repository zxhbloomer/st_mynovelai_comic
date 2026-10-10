import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';
import { extensionFolderPath } from './core/constants.js';

const EXT_ID = 'HuaManhua';
let settingsRoot = null;
let sourceModulePromise = null;

function loadSourceModule() {
    sourceModulePromise ||= import('./modules/draw/providers/novelai/novel-draw.js');
    return sourceModulePromise;
}

async function waitForSettingsRoot() {
    for (let i = 0; i < 400; i += 1) {
        const root = document.querySelector('#extensions_settings') || document.querySelector('#extensions_settings2');
        if (root) return root;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return null;
}

async function mountSettings() {
    const host = await waitForSettingsRoot();
    if (!host || document.getElementById('huamanhua-settings')) return;
    const response = await fetch(`${extensionFolderPath}/settings.html`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`花漫画设置加载失败（HTTP ${response.status}）`);
    const wrapper = document.createElement('div');
    wrapper.id = 'huamanhua-settings';
    wrapper.innerHTML = await response.text();
    host.append(wrapper);
    settingsRoot = wrapper;
    const enabled = wrapper.querySelector('#huamanhua_enabled');
    if (!enabled) throw new Error('花漫画设置控件缺失');
    enabled.checked = extension_settings[EXT_ID].enabled === true;
    enabled.addEventListener('change', async () => {
        extension_settings[EXT_ID].enabled = enabled.checked;
        saveSettingsDebounced();
        if (enabled.checked) {
            const source = await loadSourceModule();
            window.isXiaobaixEnabled = true;
            await source.initNovelDraw();
        } else {
            const source = await loadSourceModule();
            await source.cleanupNovelDraw();
            window.isXiaobaixEnabled = false;
        }
    });
}

export async function initNovelDraw() {
    extension_settings[EXT_ID] ||= { enabled: false };
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

