import assert from 'node:assert/strict';
import { createGenerationOverlay } from '../../modules/draw/shared/generation-overlay.js';
let visible = false;
const fake = { createElement() { return { className: '', textContent: '', style: {}, remove() { visible = false; } }; }, body: { append() { visible = true; } }, getElementById() { return null; } };
const overlay = createGenerationOverlay(fake);
overlay.show(); assert.equal(visible, true); overlay.hide(); assert.equal(visible, false);
console.log('generation overlay: ok');

let calls = []; const result = await (await import('../../modules/draw/shared/comic-regeneration.js')).regenerateComicFloor({ hasContent: true, confirm: async () => false, collectFocus: async () => 'x', clear: async () => calls.push('clear'), generate: async () => calls.push('generate') }); assert.deepEqual(calls, []); assert.equal(result.cancelled, true); console.log('comic regeneration: ok');
