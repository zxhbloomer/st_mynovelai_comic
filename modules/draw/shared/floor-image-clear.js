import { createDrawImageSlotRegex } from './image-marker-syntax.js';

// Capture the floor before any asynchronous removal can change the active chat.
export async function clearFloorImageSlots({ messageId, getContext, removeSlot }) {
    const ctx = getContext();
    const chatId = String(ctx.chatId);
    const message = ctx.chat?.[messageId];
    if (!message) throw new Error('当前楼层不存在');
    const swipeIndex = message.swipe_id ?? 0;
    const slotIds = [...new Set([...String(message.mes || '').matchAll(createDrawImageSlotRegex())]
        .map(match => match[1]))];
    let removed = 0;
    for (const slotId of slotIds) {
        const current = getContext();
        if (String(current.chatId) !== chatId || current.chat?.[messageId] !== message
            || (message.swipe_id ?? 0) !== swipeIndex) {
            throw new Error('聊天或楼层版本已变化，已停止清理');
        }
        await removeSlot({ dataset: { mesid: String(messageId), slotId } });
        removed++;
    }
    return removed;
}
