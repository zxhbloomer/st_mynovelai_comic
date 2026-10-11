import { comicForRedraw } from './comic-edit-state.js';
import { getContext } from '../../../../../../extensions.js';
import { getPreview, getPreviewsBySlot, getSlotSelection, deletePreview, clearSlotSelection, setSlotSelection } from './gallery-cache.js';
import { generatePreparedChatImages } from './prepared-chat-images.js';
import { getSlotActivity } from './slot-activity.js';
import { getPendingImageJobSlots, discardPendingImageSlot } from './pending-image-jobs.js';
import { discardChatImagePlacement, commitChatImageRemoval, rollbackChatImageRemoval } from './chat-image-placement.js';
import { isMessageBeingEdited, renderPreviewsForMessage, syncRenderedMessageFromState, clearDrawSavedEntry, syncDrawSavedFromPreview, getDrawSavedEntry, getDrawImageRecord } from './draw-common.js';
import { isSceneSlotAlive } from './scene-placement.js';
import { saveChatAndConfirm, withConfirmableChatMutation } from './confirmable-chat-save.js';
import { findImageJobDeliverySlot } from './image-job-delivery-target.js';
import { DRAW_SLOT_COPY, hasPreviewImage } from './image-record.js';

const redraws = new Map();

// A failed attempt remains editable, but must not strand the slot's older images.
// This action only changes selection; it never submits another drawing request.
export async function restoreImageCard(container) {
    try {
        const ctx = getContext();
        const messageId = Number(container.dataset.mesid);
        const message = ctx.chat[messageId];
        const slotId = container.dataset.slotId;
        const preview = (await getPreviewsBySlot(slotId)).find(hasPreviewImage);
        if (!preview) throw new Error(DRAW_SLOT_COPY.missingRecord);
        if (String(getContext().chatId) !== String(ctx.chatId) || ctx.chat[messageId] !== message
            || !isSceneSlotAlive(message?.mes, slotId)) throw new Error(DRAW_SLOT_COPY.sourceChanged);
        await setSlotSelection(slotId, preview.imgId);
        if (String(getContext().chatId) !== String(ctx.chatId) || ctx.chat[messageId] !== message) return false;
        if (preview.savedUrl) await syncDrawSavedFromPreview(messageId, preview);
        else await clearDrawSavedEntry(messageId, slotId);
        await renderPreviewsForMessage(messageId, { refreshSlotIds: [slotId] });
        return true;
    } catch (error) {
        console.error(DRAW_SLOT_COPY.restoreFailed, error);
        globalThis.toastr?.error(error.message, DRAW_SLOT_COPY.restoreFailed);
        return false;
    }
}

export function redrawImageCard(provider, container) {
    const slotId = container.dataset.slotId;
    if (redraws.has(slotId)) return redraws.get(slotId);
    if (getSlotActivity(slotId)) return Promise.resolve();
    const operation = redraw(provider, container).finally(() => redraws.delete(slotId));
    redraws.set(slotId, operation);
    return operation;
}

async function redraw(provider, container) {
    const slotId = container.dataset.slotId;
    const messageId = Number(container.dataset.mesid);
    const ctx = getContext();
    const message = ctx.chat[messageId];
    if (!message || !isSceneSlotAlive(message.mes, slotId)) throw new Error(DRAW_SLOT_COPY.sourceChanged);
    const sourceText = message.mes;
    const swipeIndex = message.swipe_id ?? 0;
    try {
        // A refresh drops runtime activity, not the submitted backend job. Do
        // not turn a journal read failure into permission for a paid resubmit.
        if ((await getPendingImageJobSlots()).has(slotId)) return;
        const record = await getDrawImageRecord(message, slotId, container.dataset.imgId);
        if (record?.comic) {
            const comic = comicForRedraw(record.comic);
            return await generatePreparedChatImages(provider, { ctx, message, messageId, sourceText, swipeIndex,
                plannerSourceText: comic.sourceText, plannerSourceOrigin: 'captured',
                tasks: [{ scene: comic.image, comic, placement: { mode: 'existing', slotId } }] });
        }
        const tags = record?.tags ?? container.dataset.tags;
        if (/^\s*@(?:page|position)\b/i.test(tags || '')) throw new Error('完整图片描述已丢失，无法恢复重画依据');
        if (!tags?.trim()) throw new Error(DRAW_SLOT_COPY.emptyTags);
        return await generatePreparedChatImages(provider, { ctx, message, messageId, sourceText, swipeIndex,
            generationSnapshot: record?.generationSnapshot,
            plannerSourceText: record?.plannerSourceText,
            plannerSourceOrigin: record?.plannerSourceOrigin,
            tasks: [{ scene: tags, characterPrompts: record?.characterPrompts ?? [],
                negativePrompt: record?.negativePrompt ?? undefined,
                placement: { mode: 'existing', slotId } }] });
    } finally {
        if (String(getContext().chatId) === String(ctx.chatId)) await renderPreviewsForMessage(messageId, { refreshSlotIds: [slotId] });
    }
}

// Body cards and both galleries delete through the same record/selection/chat lifecycle.
export async function deleteImageVersion({ imgId, slotId, messageId } = {}) {
    const ctx = getContext();
    let record = await getPreview(imgId);
    slotId ||= record?.slotId;
    if (!slotId) throw new Error(DRAW_SLOT_COPY.missingRecord);
    const target = findImageJobDeliverySlot(ctx.chat, slotId);
    const message = target?.message || ctx.chat?.[Number(messageId)];
    record ||= await getDrawImageRecord(message, slotId, imgId);
    if (!record) throw new Error(DRAW_SLOT_COPY.missingRecord);
    // Do not delete the database half of a chat image whose message cannot be updated.
    if (!record.source && record.chatId && String(record.chatId) !== String(ctx.chatId)) {
        throw new Error('请先打开图片所属聊天再删除');
    }
    if (target && !target.isActiveSwipe) throw new Error('请先切换到图片所属回复版本再删除');
    const remaining = (await getPreviewsBySlot(slotId)).filter(row => row.imgId !== imgId);
    if (record.comic && !remaining.length && target) {
        await removeChatImageSlot({ dataset: { slotId, mesid: String(target.messageId) } });
        return { record, previews: [], messageId: target.messageId };
    }
    const selectedId = await getSlotSelection(slotId) || getDrawSavedEntry(message, slotId)?.imgId;
    const selected = remaining.find(row => row.imgId === selectedId) || remaining.find(hasPreviewImage) || remaining[0];
    if (target && (String(getContext().chatId) !== String(ctx.chatId)
        || getContext().chat?.[target.messageId] !== message)) throw new Error(DRAW_SLOT_COPY.sourceChanged);
    if (target) {
        if (selected?.savedUrl) await syncDrawSavedFromPreview(target.messageId, selected);
        else await clearDrawSavedEntry(target.messageId, slotId);
    } else if (message && getDrawSavedEntry(message, slotId)?.imgId === imgId) {
        await clearDrawSavedEntry(ctx.chat.indexOf(message), slotId);
    }
    await deletePreview(imgId);
    if (selected) await setSlotSelection(slotId, selected.imgId);
    else await clearSlotSelection(slotId);
    return { record, previews: remaining, messageId: target?.messageId };
}

export async function removeChatImageSlot(container) {
    const ctx = getContext();
    const messageId = Number(container.dataset.mesid);
    const slotId = container.dataset.slotId;
    const message = ctx.chat[messageId];
    const swipeIndex = message?.swipe_id ?? 0;
    const isCurrentTarget = () => String(getContext().chatId) === String(ctx.chatId)
        && getContext().chat[messageId] === message && (message.swipe_id ?? 0) === swipeIndex;
    const assertRemovable = () => {
        if (!isCurrentTarget() || isMessageBeingEdited(messageId) || !isSceneSlotAlive(message.mes, slotId)) {
            throw new Error(DRAW_SLOT_COPY.sourceChanged);
        }
    };
    if (!message || !isSceneSlotAlive(message.mes, slotId)) throw new Error(DRAW_SLOT_COPY.sourceChanged);
    await withConfirmableChatMutation(ctx, async () => {
        assertRemovable();
        // Mark only this item, not its batch. This intent precedes cleanup and
        // survives refresh even if native persistence of the deletion fails.
        getSlotActivity(slotId)?.discard?.();
        discardChatImagePlacement(slotId);
        await discardPendingImageSlot(slotId);
        assertRemovable();
        const change = commitChatImageRemoval({ message, swipeIndex, slotId });
        try {
            await saveChatAndConfirm({ ctx, verify: persisted => !findImageJobDeliverySlot(persisted, slotId) });
        } catch (error) {
            if (error.saveAttempted === false && isCurrentTarget()) {
                rollbackChatImageRemoval(change);
            }
            throw error;
        }
        if (isCurrentTarget()) await clearDrawSavedEntry(messageId, slotId);
        for (const record of await getPreviewsBySlot(slotId)) await deletePreview(record.imgId);
        await clearSlotSelection(slotId);
        await syncRenderedMessageFromState(messageId, { chatId: ctx.chatId, expectedMessage: message });
    });
}
