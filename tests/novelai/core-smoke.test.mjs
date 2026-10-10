import assert from 'node:assert/strict';
import { compileNovelImageRequest } from '../../modules/draw/providers/novelai/compiler.js';
import { isNovelV5Model } from '../../modules/draw/providers/novelai/novel-model-capabilities.js';

assert.equal(isNovelV5Model('nai-diffusion-5-full'), true);
const legacy = compileNovelImageRequest({ scene: '1girl', characterPrompts: [], negativePrompt: '' }, { apiBaseUrl: 'https://image.novelai.net', params: { model: 'nai-diffusion-4-5-full', width: 832, height: 1216 }, defaultParams: {}, resolveForBackend: true }, 1);
assert.equal(legacy.transport, 'legacy-image');
assert.equal(legacy.payload.action, 'generate');
const v5 = compileNovelImageRequest({ scene: '1girl', characterPrompts: [], negativePrompt: '' }, { apiBaseUrl: 'https://image.novelai.net', params: { model: 'nai-diffusion-5-full', width: 64, height: 64, steps: 1 }, defaultParams: {}, resolveForBackend: true }, 1);
assert.equal(v5.transport, 'msgpack-stream');
assert.equal(v5.payload.parameters.stream, 'msgpack');
console.log('novelai core smoke: ok');

