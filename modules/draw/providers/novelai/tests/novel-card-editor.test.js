import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { reparseNovelCardPrompt } from '../novel-card-reparse.js';
import { resolveNovelRedrawConfig } from '../novel-generation-snapshot.js';
import { joinTags } from '../../../shared/character-prompts.js';

const source = fs.readFileSync(new URL('../novel-draw.js', import.meta.url), 'utf8');
const editorCode = source.slice(source.indexOf('const cardEditDrafts ='), source.indexOf('async function refreshSingleImage('));

// Exercise the actual editor handlers without loading SillyTavern or sending requests.
function createEditor(parse) {
    const fields = { source: { value: '修改后的描述', disabled: false }, status: { textContent: '' }, tags: { innerHTML: '旧 TAG' } };
    const buttons = [{ disabled: false }, { disabled: false }];
    const panel = {
        children: [], style: {},
        querySelector: selector => ({ '[data-type="source"]': fields.source, '[data-parse-status]': fields.status,
            '[data-tag-fields]': fields.tags, '.xb-nd-edit-scroll': { remove() {} } })[selector] || null,
        querySelectorAll: () => buttons,
    };
    const container = {
        dataset: { mesid: '0', imgId: 'image', slotId: 'slot' }, isConnected: true,
        querySelector: selector => selector === '.xb-nd-edit' ? panel
            : selector === '[data-type="source"]' ? fields.source
                : selector.includes('data-type="char"') ? { value: '手动微调的角色 TAG' } : null,
    };
    const context = { chatId: 'chat', chat: [{ mes: '原正文' }] };
    const record = { tags: 'old', characterPrompts: [{ prompt: 'old character' }] };
    let saved;
    const sandbox = vm.createContext({ AbortController, reparseNovelCardPrompt, resolveNovelRedrawConfig, joinTags,
        getContext: () => context, getCardPreview: async () => record,
        loadSettings: async () => {}, loadSharedDrawSettings: async () => {},
        getRuntimeSettings: () => ({ characterTags: [] }), getActiveParamsPreset: () => ({ positivePrefix: 'quality' }),
        cloneSettingsObject: value => structuredClone(value), detectPresentCharacters: () => [],
        buildTextSourceTasks: parse, isSceneSlotAlive: () => true,
        escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
        persistCardTagEdits: async (target, compile) => { saved = compile('new scene', [], record); },
        showToast: () => {}, DRAW_SLOT_COPY: { tagSaved: 'saved', tagSaveFailed: 'failed' }, console: { error() {} },
    });
    vm.runInContext(editorCode + '\nglobalThis.editor = { cardEditDrafts, reparseEditedDescription, saveEditedTags };', sandbox);
    const draft = { source: { text: '原描述', origin: 'captured' }, parsedSourceText: '原描述' };
    sandbox.editor.cardEditDrafts.set(container, draft);
    return { editor: sandbox.editor, container, fields, buttons, draft, context, saved: () => saved };
}

test('editor saves the newly parsed character list, source and manual TAG adjustments together', async () => {
    const fixture = createEditor(async () => [{ scene: '<new scene>', chars: [{ name: '新角色', appear: 'long hair' }] }]);
    assert.equal(await fixture.editor.saveEditedTags(fixture.container), false, 'source edits require parsing first');
    await fixture.editor.reparseEditedDescription(fixture.container);
    assert.match(fixture.fields.tags.innerHTML, /&lt;new scene&gt;/);
    assert.equal(await fixture.editor.saveEditedTags(fixture.container), true);
    assert.equal(fixture.saved().plannerSourceText, '修改后的描述');
    assert.equal(fixture.saved().characterPrompts.length, 1);
    assert.equal(fixture.saved().characterPrompts[0].name, '新角色');
    assert.equal(fixture.saved().characterPrompts[0].prompt, '手动微调的角色 TAG');
});

test('parser failure preserves the current TAG fields and restores controls', async () => {
    const fixture = createEditor(async () => { throw new Error('provider failed'); });
    await fixture.editor.reparseEditedDescription(fixture.container);
    assert.equal(fixture.fields.tags.innerHTML, '旧 TAG');
    assert.match(fixture.fields.status.textContent, /provider failed/);
    assert.equal(fixture.fields.source.disabled, false);
    assert.ok(fixture.buttons.every(button => !button.disabled));
});

test('results from a previous chat are not applied to the image editor', async () => {
    const fixture = createEditor(async () => {
        fixture.context.chatId = 'different chat';
        return [{ scene: 'wrong result' }];
    });
    await fixture.editor.reparseEditedDescription(fixture.container);
    assert.equal(fixture.fields.tags.innerHTML, '旧 TAG');
    assert.equal(fixture.draft.parsed, undefined);
});
