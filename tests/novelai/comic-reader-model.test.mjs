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
for (const mode of ['points', 'inline', 'end']) {
 const message = { mes: '正文[image:slot-2][image:slot-1]', extra: {
  xiaobaixDrawSaved: { 'slot-2': { savedUrl: '/two.png' } },
  novelDrawSaved: { 'slot-1': { savedUrl: '/one.png' }, obsolete: { savedUrl: '/old.png' } },
 } };
 assert.deepEqual(buildReaderFloor(message, mode, null, []).pages.map(p => p.url), ['/two.png', '/one.png']);
 assert.deepEqual(buildReaderFloor(message, mode, null, [
  { slotId: 'slot-1', savedUrl: '/selected.png' },
  { slotId: 'obsolete', savedUrl: '/stale.png' },
 ]).pages.map(p => p.url), ['/two.png', '/selected.png']);
}
assert.equal(buildReaderFloor({ mes: '正文[image:slot-1]', extra: { xiaobaixDrawSaved: { 'slot-1': { savedUrl: '/old.png' } } } }, 'points', null, [{slotId:'slot-1',url:''}]).pages.length, 0);
assert.equal(buildReaderFloor({ mes:'正文' }, 'points', null, [{slotId:'removed',savedUrl:'/stale.png'}]).pages.length, 0);
assert.equal(buildReaderFloor({mes:'正文',extra:{xiaobaixDrawSaved:{'slot-1':{}},novelDrawSaved:{'slot-1':{savedUrl:'/legacy.png'}}}}, 'points', null, []).pages[0].url, '/legacy.png');
