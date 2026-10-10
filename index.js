import { extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

const EXT_ID = 'HuaManhua';
let settingsRoot = null;
let settingsSetupPromise = null;
let runtimePromise = null;
let runtimeInitPromise = null;

function loadRuntime() {
    runtimePromise ||= import('./modules/draw/providers/novelai/novel-draw.js');
    return runtimePromise;
}

function setupSettings() {
    if (settingsSetupPromise) return settingsSetupPromise;
    settingsSetupPromise = (async () => {
        if (document.getElementById('huamanhua-settings')) return;
        const host = document.querySelector('#extensions_settings');
        if (!host) return;
        let html;
        try {
            html = await renderExtensionTemplateAsync('third-party/st_mynovelai_comic', 'settings');
        } catch {
            html = '<div class="inline-drawer" id="huamanhua-settings-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>花漫画</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"><div class="flex-container alignItemsCenter"><input type="checkbox" id="huamanhua_enabled"><label for="huamanhua_enabled">花漫画：启用 / 禁用</label></div></div></div>';
        }
        const wrapper = document.createElement('div');
        wrapper.id = 'huamanhua-settings';
        wrapper.innerHTML = html;
        host.append(wrapper);
        settingsRoot = wrapper;
        const enabled = wrapper.querySelector('#huamanhua_enabled');
        if (!enabled) return;
        enabled.checked = extension_settings[EXT_ID].enabled === true;
        enabled.addEventListener('change', async () => {
            extension_settings[EXT_ID].enabled = enabled.checked;
            saveSettingsDebounced();
            const runtime = await loadRuntime();
            window.isXiaobaixEnabled = enabled.checked;
            if (enabled.checked) await runtime.initNovelDraw();
            else await runtime.cleanupNovelDraw();
        });
    })();
    return settingsSetupPromise;
}

export async function initNovelDraw() {
    extension_settings[EXT_ID] ||= { enabled: false };
    await setupSettings();
    window.isXiaobaixEnabled = extension_settings[EXT_ID].enabled === true;
    if (!window.isXiaobaixEnabled) return false;
    if (runtimeInitPromise) return runtimeInitPromise;`n    runtimeInitPromise = loadRuntime().then(runtime => runtime.initNovelDraw());`n    try { return await runtimeInitPromise; } finally { runtimeInitPromise = null; }
}

export async function cleanup() {
    if (runtimeInitPromise) await runtimeInitPromise.catch(() => {});
    if (runtimePromise) await (await runtimePromise).cleanupNovelDraw();
    settingsRoot?.remove();
    settingsRoot = null;
    settingsSetupPromise = null;
}



