import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';
import { extensionFolderPath } from './core/constants.js';
import { cleanupNovelDraw as cleanupSource, initNovelDraw as initSource } from './modules/draw/providers/novelai/novel-draw.js';

const EXT_ID = 'HuaManhua';
let settingsRoot = null;

async function waitForSettingsRoot() {
    for (let i = 0; i < 100; i += 1) {
        const root = document.querySelector('#extensions_settings');
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
    const enabled = wrapper.querySelector('#xiaobaix_enabled');
    if (enabled) {
        enabled.id = 'huamanhua_enabled';
        enabled.nextElementSibling.textContent = '花漫画：启用 / 禁用';
        enabled.checked = extension_settings[EXT_ID].enabled === true;
        enabled.addEventListener('change', async () => {
            extension_settings[EXT_ID].enabled = enabled.checked;
            saveSettingsDebounced();
            if (enabled.checked) await initSource();
            else await cleanupSource();
        });
    }
    wrapper.querySelector('#xiaobaix_draw_provider')?.remove();
    wrapper.querySelector('label[for="xiaobaix_draw_provider"]')?.remove();
    wrapper.querySelector('#xiaobaix_draw_open_settings')?.remove();
}

export async function initNovelDraw() {
    extension_settings[EXT_ID] ||= { enabled: false };
    await mountSettings();
    window.isXiaobaixEnabled = extension_settings[EXT_ID].enabled === true;
    if (!window.isXiaobaixEnabled) return false;
    return await initSource();
}

export async function cleanup() {
    await cleanupSource();
    settingsRoot?.remove();
    settingsRoot = null;
}
