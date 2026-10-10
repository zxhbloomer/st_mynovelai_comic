import test from 'node:test';
import assert from 'node:assert/strict';
import { clearFloorImageSlots } from '../../modules/draw/shared/floor-image-clear.js';

test('clears only distinct image slots in the selected floor', async () => {
    const ctx = { chatId: 'chat', chat: [{ mes: '正文[image:a][image:b][image:a]', swipe_id: 0 },
        { mes: '另一层[image:other]' }] };
    const removed = [];
    const count = await clearFloorImageSlots({ messageId: 0, getContext: () => ctx,
        removeSlot: async container => removed.push({ ...container.dataset }) });
    assert.equal(count, 2);
    assert.deepEqual(removed, [{ mesid: '0', slotId: 'a' }, { mesid: '0', slotId: 'b' }]);
    assert.equal(ctx.chat[1].mes, '另一层[image:other]');
});

test('stops clearing when the active chat or swipe changes', async () => {
    for (const change of [ctx => { ctx.chatId = 'other'; }, ctx => { ctx.chat[0].swipe_id = 1; }]) {
        const ctx = { chatId: 'chat', chat: [{ mes: '[image:a][image:b]', swipe_id: 0 }] };
        const removed = [];
        await assert.rejects(clearFloorImageSlots({ messageId: 0, getContext: () => ctx,
            removeSlot: async container => { removed.push(container.dataset.slotId); change(ctx); } }), /已停止清理/);
        assert.deepEqual(removed, ['a']);
    }
});

test('a floor without image slots performs no deletion', async () => {
    assert.equal(await clearFloorImageSlots({ messageId: 0,
        getContext: () => ({ chatId: 'chat', chat: [{ mes: '只有正文' }] }),
        removeSlot: async () => assert.fail('unexpected deletion') }), 0);
});
