import assert from 'node:assert/strict';
import { createReaderStateStore, normalizeReaderState } from '../../modules/draw/shared/comic-reader-storage.js';

const data = new Map();
const storage = {
    async get(key, fallback) { return data.has(key) ? data.get(key) : fallback; },
    async set(key, value) { data.set(key, value); },
    async delete(key) { data.delete(key); },
};
const store = createReaderStateStore(storage);
const state = normalizeReaderState({ chatId: 'chat-a', lastFloorId: 3, floors: { 3: { pageIndex: 1 } } });
await store.save('chat-a', state);
assert.equal((await store.load('chat-a')).floors['3'].pageIndex, 1);
assert.equal(await store.load('chat-b'), null);
await store.clear('chat-a');
assert.equal(await store.load('chat-a'), null);
console.log('comic reader storage: ok');
