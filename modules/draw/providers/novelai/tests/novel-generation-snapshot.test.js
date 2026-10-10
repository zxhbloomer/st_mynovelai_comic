import test from 'node:test';
import assert from 'node:assert/strict';
import { captureNovelGenerationSnapshot, resolveNovelRedrawConfig } from '../novel-generation-snapshot.js';
import { compile } from '../compiler.js';
import { executePreparedSlots } from '../../../shared/prepared-slot-executor.js';

test('redraw preserves actual dimensions, seed and preset after current settings change', () => {
    const preset = { id: 'original', name: '原预设', positivePrefix: 'quality', negativePrefix: 'bad',
        params: { model: 'nai-diffusion-4-5-full', width: 1216, height: 832, seed: -1,
            steps: 28, scale: 6, cfg_rescale: 0.3, scheduler: 'karras', apiKey: 'secret' } };
    const payload = { model: preset.params.model,
        parameters: { width: 832, height: 1216, seed: 123, steps: 28, scale: 6, cfg_rescale: 0.3 } };
    const snapshot = captureNovelGenerationSnapshot(preset, payload);
    preset.params.scale = 10;
    const settings = { overrideSize: '1024x1024', apiKey: 'current-secret', sendMode: 'backend' };
    const redraw = resolveNovelRedrawConfig(settings, preset, snapshot);
    assert.equal(redraw.settings.apiKey, 'current-secret');
    assert.equal(redraw.settings.overrideSize, 'default');
    assert.deepEqual([redraw.preset.params.width, redraw.preset.params.height, redraw.preset.params.seed], [832, 1216, 123]);
    assert.equal(redraw.preset.params.scale, 6);
    assert.equal(redraw.preset.positivePrefix, 'quality');
    assert.equal(settings.overrideSize, '1024x1024');
    assert.equal(JSON.stringify(snapshot).includes('secret'), false);
});

test('legacy images keep the current configuration without inventing a snapshot', () => {
    const settings = { overrideSize: '1024x1024' };
    const preset = { name: '当前预设', params: { seed: -1 } };
    assert.deepEqual(resolveNovelRedrawConfig(settings, preset, null), { settings, preset });
});

test('the real compiler redraws edited prompts with the original effective parameters', () => {
    const recipe = { apiBaseUrl: 'https://image.novelai.net', apiKey: 'secret', resolveForBackend: false,
        timeout: 60000, requestDelay: { min: 0, max: 0 }, autoLearnEnabled: false, autoLearnMode: 'new_only',
        overrideSize: '832x1216', positivePrefix: 'quality', seeds: [987],
        params: { model: 'nai-diffusion-4-5-full', sampler: 'k_euler', scheduler: 'karras',
            width: 1024, height: 1024, seed: -1, steps: 28, scale: 6, cfg_rescale: 0.2 } };
    const first = compile([{ scene: 'old scene' }], recipe).items[0].request.payload;
    const snapshot = captureNovelGenerationSnapshot({ name: '原预设', positivePrefix: recipe.positivePrefix,
        params: recipe.params }, first);
    const { settings, preset } = resolveNovelRedrawConfig({ overrideSize: '1216x832' }, {}, snapshot);
    const second = compile([{ scene: 'edited scene' }], { ...recipe, ...settings, ...preset,
        seeds: [preset.params.seed] }).items[0].request.payload;
    assert.equal(second.input, 'quality, edited scene');
    for (const key of ['width', 'height', 'steps', 'scale', 'cfg_rescale', 'sampler', 'noise_schedule', 'seed']) {
        assert.equal(second.parameters[key], first.parameters[key], key);
    }
});

test('pending, delivered and recoverable records retain each image configuration', async () => {
    const snapshot = { version: 1, provider: 'novelai', presetName: '原预设', params: { width: 832 } };
    const stored = [];
    await executePreparedSlots({ items: [{ slotId: 'slot', imgId: 'image', generationSnapshot: snapshot }],
        backend: true, commit: async () => true, resolveTarget: async () => ({ messageId: 1 }),
        store: async record => stored.push(record), remove: async () => {}, select: async () => {},
        activity: () => {}, render: async () => {}, classifyError: () => ({}),
        run: async handlers => {
            assert.deepEqual(handlers.recoverable.plan.items[0].previewMetadata.generationSnapshot, snapshot);
            await handlers.recoverable.commitPlacements();
            await handlers.onItemReady({ index: 0, base64: 'image' });
        } });
    assert.ok(stored.length >= 2);
    for (const record of stored) assert.deepEqual(record.generationSnapshot, snapshot);
});
