import assert from 'node:assert/strict';
import { normalizeReaderIndex, getReaderPageTarget } from '../../modules/draw/shared/comic-reader.js';
assert.equal(normalizeReaderIndex(-1, 3), 0);
assert.equal(normalizeReaderIndex(8, 3), 2);
assert.deepEqual(getReaderPageTarget({ pageIndex: 0, pageCount: 2, floorIndex: 1, floorCount: 3, direction: -1 }), { type: 'floor', floorIndex: 0, pageIndex: -1 });
assert.deepEqual(getReaderPageTarget({ pageIndex: 1, pageCount: 2, floorIndex: 1, floorCount: 3, direction: 1 }), { type: 'floor', floorIndex: 2, pageIndex: 0 });
console.log('comic reader navigation: ok');
