import { snapshotNovelRequestConfig, resolveNovelImageTransport } from './core/novel-request-config.js';
import { compileNovelImageRequest } from './core/compiler.js';
import { readNovelV5FinalImage } from './core/novel-v5-stream.js';
import { extractImageFromResponse } from './core/novel-image-response.js';
import { insertNovelAIImage } from './host.js';
import { initNovelAIFloatingButton } from './floating.js';
import { initNovelAIFloorButtons } from './floor-buttons.js';
import { extension_settings } from '../../extensions.js';
import { saveSettingsDebounced } from '../../../script.js';
import { savePreview } from './storage/preview-cache.js';
import { openNovelAIGallery } from './gallery.js';
import { cancelNovelAIGeneration, isNovelAIGenerationActive } from './generation-state.js';

const EXTENSION_KEY = 'st_mynovelai_comic';
const DEFAULTS = Object.freeze({ apiBaseUrl: 'https://image.novelai.net', apiKey: '', sendMode: 'backend', useImageBackendJobs: false, timeout: 120000 });
let jsZipPromise;
async function loadJSZip() {
    if (window.JSZip) return window.JSZip;
    if (!jsZipPromise) jsZipPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error('JSZip 未提供'));
        script.onerror = () => reject(new Error('JSZip 加载失败'));
        document.head.append(script);
    });
    return jsZipPromise;
}
function getSettingsStore() { extension_settings[EXTENSION_KEY] ||= { ...DEFAULTS }; return extension_settings[EXTENSION_KEY]; }
async function probeBackend() { const response = await fetch('/api/plugins/sillytavern-novelai/status'); if (!response.ok) throw new Error(`NovelAI backend unavailable (${response.status})`); return response.json(); }
export async function generateNovelAIImage({ scene = '', characterPrompts = [], negativePrompt = '', params = {}, seed = 1 } = {}) {
    const settings = getSettingsStore();
    const recipe = snapshotNovelRequestConfig(settings, { overrideSize: params.overrideSize }, DEFAULTS.timeout);
    const transport = resolveNovelImageTransport({ sendMode: recipe.sendMode, useImageBackendJobs: recipe.useImageBackendJobs });
    const compiled = compileNovelImageRequest({ scene, characterPrompts, negativePrompt, params }, { ...recipe, params, defaultParams: params, resolveForBackend: transport !== 'frontend', baseHref: location.origin }, seed);
    if (transport === 'frontend' && compiled.isV5) throw new Error('NovelAI V5 浏览器直连需要服务端插件，请切换为“服务端插件”发送模式');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), recipe.timeout);
    window.__stNovelAIAbortController = controller;
    let response;
    try {
        const request = transport === 'frontend'
            ? { url: compiled.apiUrl, headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(compiled.payload) }
            : { url: '/api/plugins/sillytavern-novelai/v1/generate-image', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: settings.apiKey, url: compiled.apiUrl, payload: compiled.payload, timeout: recipe.timeout, insecure: recipe.insecureTLS }) };
        response = await fetch(request.url, { method: 'POST', headers: request.headers, body: request.body, signal: controller.signal });
    } finally { clearTimeout(timeoutId); window.__stNovelAIAbortController = null; }
    if (!response.ok) throw new Error(`NovelAI 请求失败 HTTP ${response.status}`);
    let result;
    if (compiled.isV5) { const image = await readNovelV5FinalImage(response, { signal: controller.signal }); const bytes = image.buffer || image; let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); result = { ok: true, base64: btoa(binary), mime: 'image/png' }; }
    else if (transport === 'frontend') {
        const bytes = new Uint8Array(await response.arrayBuffer());
        const dataUrl = await extractImageFromResponse(bytes, loadJSZip, controller.signal);
        const [header, base64] = dataUrl.split(',', 2);
        result = { ok: true, base64: base64 || header, mime: base64 ? (header.match(/^data:([^;]+)/)?.[1] || 'image/png') : 'image/png' };
    } else { result = await response.json(); if (!result.ok) throw new Error(result.error || 'NovelAI generation failed'); }
    if (result.base64) await savePreview({ id: `novelai-${Date.now()}`, base64: result.base64, mime: result.mime || 'image/png', scene }); return result;
}
export async function generateAndInsertNovelAIImage(options = {}) { const result = await generateNovelAIImage(options); await insertNovelAIImage({ base64: result.base64, mime: result.mime, caption: options.caption || 'NovelAI image' }); return result; }
export async function testNovelAIConnection({ model = 'nai-diffusion-4-5-full' } = {}) { const settings = getSettingsStore(); const payload = { model, input: 'test', action: 'generate', parameters: { width: 64, height: 64, steps: 1, n_samples: 1 } }; const response = await fetch('/api/plugins/sillytavern-novelai/v1/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: settings.apiKey, url: settings.apiBaseUrl, payload, timeout: settings.timeout }) }); return response.json(); }
function mountSettings() {
    const panel = document.createElement('div'); panel.className = 'novelai-extension';
    panel.innerHTML = '<label>NovelAI API 地址 <input data-nai-key="apiBaseUrl" type="url"></label><label>API Key <input data-nai-key="apiKey" type="password"></label><label>发送模式 <select data-nai-key="sendMode"><option value="backend">服务端插件</option><option value="frontend">浏览器直连</option></select></label><label>超时(ms) <input data-nai-key="timeout" type="number" min="1000" step="1000"></label><button type="button" data-nai-action="test">测试连接</button><button type="button" data-nai-action="gallery">打开图库</button>';
    document.querySelector('#extensions_settings')?.append(panel);
    for (const input of panel.querySelectorAll('[data-nai-key]')) { const key = input.dataset.naiKey; input.value = getSettingsStore()[key] ?? DEFAULTS[key] ?? ''; input.addEventListener('change', () => { getSettingsStore()[key] = input.type === 'number' ? Number(input.value) : input.value; saveSettingsDebounced(); }); }
    panel.querySelector('[data-nai-action=gallery]')?.addEventListener('click', openNovelAIGallery);
    panel.querySelector('[data-nai-action=test]')?.addEventListener('click', async (event) => { event.currentTarget.disabled = true; try { const result = await testNovelAIConnection(); alert(result.ok ? 'NovelAI 连接成功' : (result.error || 'NovelAI 连接失败')); } catch (error) { alert(error.message); } finally { event.currentTarget.disabled = false; } });
}
export async function initNovelAIExtension() { mountSettings(); initNovelAIFloatingButton(); initNovelAIFloorButtons(); window.stNovelAI = Object.freeze({ getSettings: () => ({ ...getSettingsStore() }), snapshot: generation => snapshotNovelRequestConfig(getSettingsStore(), generation, DEFAULTS.timeout), resolveTransport: generation => resolveNovelImageTransport({ sendMode: getSettingsStore().sendMode, useImageBackendJobs: generation?.useImageBackendJobs ?? getSettingsStore().useImageBackendJobs }), probeBackend, generateNovelAIImage, generateAndInsertNovelAIImage, testNovelAIConnection }); try { await probeBackend(); console.info('[NovelAI] backend ready'); } catch (error) { console.warn('[NovelAI] backend unavailable', error); } }


