import assert from 'node:assert/strict';
import { parseNovelPromptPresetImport } from '../../public/scripts/extensions/novelai/core/novel-prompt-import.js';
import { migrateLegacyNovelTagGuide, migrateLegacyNovelPromptSettings } from '../../public/scripts/extensions/novelai/core/novel-prompt-migration.js';
import { resolveAutoLearnCharacter } from '../../public/scripts/extensions/novelai/core/novel-character-learning.js';
const preset = parseNovelPromptPresetImport({ _type: 'novel-draw-prompt-template', _version: 2, name: 'test', topSystem: '', sceneRules: '' });
assert.equal(preset.name, 'test');
assert.equal(typeof migrateLegacyNovelTagGuide('custom')['v4.5'], 'string');
assert.equal(resolveAutoLearnCharacter({ name: 'Alice', type: 'girl' }, []).action, 'create');
assert.equal(resolveAutoLearnCharacter({ name: 'Alice' }, []).action, 'skip');
const migrated = migrateLegacyNovelPromptSettings({ promptPresets: [] }, { topSystem: '', sceneRules: '' }, 14);
assert.equal(Array.isArray(migrated.presets), true);
console.log('novelai prompt/learning smoke: ok');

