import assert from 'node:assert/strict';
import { parseNovelPromptPresetImport } from '../../modules/draw/providers/novelai/novel-prompt-import.js';
import { migrateLegacyNovelTagGuide } from '../../modules/draw/providers/novelai/novel-prompt-migration.js';
import { resolveAutoLearnCharacter } from '../../modules/draw/providers/novelai/novel-character-learning.js';
const preset = parseNovelPromptPresetImport({ _type: 'novel-draw-prompt-template', _version: 2, name: 'test', topSystem: '', sceneRules: '' });
assert.equal(preset.name, 'test');
assert.equal(typeof migrateLegacyNovelTagGuide('custom')['v4.5'], 'string');
assert.equal(resolveAutoLearnCharacter({ name: 'Alice', type: 'girl' }, []).action, 'create');
assert.equal(resolveAutoLearnCharacter({ name: 'Alice' }, []).action, 'skip');
console.log('novelai prompt/learning smoke: ok');



