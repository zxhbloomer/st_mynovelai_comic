import assert from 'node:assert/strict';
import { getStoryFloors, buildReaderFloor, getAdjacentStoryFloor } from '../../modules/draw/shared/comic-reader-model.js';
const chat = [
 { mes: 'user', is_user: true },
 { mes: '旁白', is_user: false, extra: { type: 'narrator' } },
 { mes: '故事一', is_user: false, extra: { xiaobaixDrawSaved: { 'slot-1': { savedUrl: '/a.png', comic: { mode: 'points' } } } } },
 { mes: '系统', is_system: true },
 { mes: '故事二', is_user: false, extra: {} },
];
const floors = getStoryFloors(chat);
assert.deepEqual(floors.map(f => f.messageId), [2, 4]);
const page = buildReaderFloor(chat[2], 'points');
assert.equal(page.pages.length, 1);
assert.equal(page.hasComic, true);
assert.equal(buildReaderFloor(chat[4], 'points').hasComic, false);
assert.equal(getAdjacentStoryFloor(floors, 2, 1).messageId, 4);
console.log('comic reader model: ok');
