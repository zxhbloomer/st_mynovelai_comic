import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCardPlannerSource, reparseNovelCardPrompt } from '../novel-card-reparse.js';

test('shows captured source separately from tags and labels legacy fallback', () => {
    assert.deepEqual(resolveCardPlannerSource({ plannerSourceText: '原描述', tags: 'english tags' }, '当前楼层'),
        { text: '原描述', origin: 'captured' });
    assert.deepEqual(resolveCardPlannerSource({}, '当前楼层'), { text: '当前楼层', origin: 'current-message' });
});

test('edited source is parsed once for one image and compiles new characters', async () => {
    let calls = 0;
    const result = await reparseNovelCardPrompt({ text: '她站在窗边。',
        settings: { characterTags: [] }, preset: { positivePrefix: 'quality', negativePrefix: 'bad',
            maxImages: 4, maxCharactersPerImage: 2, params: { model: 'nai-diffusion-4-5-full' } },
        parse: async options => {
            calls++;
            assert.equal(options.sceneSource.content, '她站在窗边。');
            assert.equal(options.preset.maxImages, 1);
            return [{ scene: 'window', chars: [{ name: '她', type: 'female', appear: 'long hair',
                action: 'standing', uc: 'hat', center: { x: 0.2, y: 0.7 } }] }];
        } });
    assert.equal(calls, 1);
    assert.equal(result.tags, 'window');
    assert.equal(result.positive, 'quality, window');
    assert.equal(result.characterPrompts.length, 1);
    assert.equal(result.characterPrompts[0].name, '她');
    assert.match(result.characterPrompts[0].prompt, /long hair/);
    assert.deepEqual(result.characterPrompts[0].center, { x: 0.2, y: 0.7 });
    assert.equal(result.negativePrompt, 'bad');
    assert.equal(result.plannerSourceText, '她站在窗边。');
});

test('rejects empty source, multiple images and cancelled results', async () => {
    const options = { settings: {}, preset: {}, parse: async () => [] };
    await assert.rejects(reparseNovelCardPrompt({ ...options, text: ' ' }), /原始描述/);
    await assert.rejects(reparseNovelCardPrompt({ ...options, text: '描述', parse: async () => [{}, {}] }), /一张/);
    const controller = new AbortController();
    await assert.rejects(reparseNovelCardPrompt({ ...options, text: '描述', signal: controller.signal,
        parse: async () => { controller.abort(); return [{ scene: 'tags' }]; } }), { name: 'AbortError' });
});
