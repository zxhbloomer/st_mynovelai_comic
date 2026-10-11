import { listPendingImageJobs, claimPendingImageJob } from './pending-image-jobs.js';
import { readPageFarewells, findJobPageFarewell } from './page-farewell.js';
import { reattachRecoverableImageJob } from './recoverable-image-jobs.js';
import { deliverPreparedImage } from './prepared-image-delivery.js';
import { requireImageJobDeliveryTarget } from './image-job-delivery-target.js';

// Reattach only: this module never creates/submits a drawing request.
export async function recoverComicRecord({ record, client, getContext, decode, store, remove,
    select, clearSelection, getPreview, render, detachSignal, reattach = reattachRecoverableImageJob }) {
    const items = record.items;
    const delivered = new Set();
    const cancel = new AbortController();
    if (record.cancelRequested || record.state === 'cancelling') cancel.abort();
    const deliver = async (index, patch, guard) => {
        const item = items[index];
        const resolveTarget = () => {
            const live = getContext();
            return requireImageJobDeliveryTarget({ currentChatId: live.chatId,
                targetChatId: record.delivery.chatId, chat: live.chat, slotId: item.slotId });
        };
        try {
            await deliverPreparedImage({ guard,
                isDiscarded: current => current.items.some(row => row.imgId === item.imgId && row.discarded),
                resolveTarget,
                persist: async target => {
                    await store({ ...record.gallery, ...item.previewMetadata, ...patch,
                        slotId: item.slotId, imgId: item.imgId, messageId: target.messageId });
                },
                remove: () => remove(item.imgId), select: () => select(item.slotId, item.imgId),
                clearSelection: () => clearSelection(item.slotId),
            });
            delivered.add(index);
            await render();
        } catch (error) { error.preserveBackendResult = true; throw error; }
    };
    return reattach({ client, record, detachSignal, cancelSignal: cancel.signal,
        onItemReady: async ({ index, response, kind, guard }) => deliver(index,
            { base64: await decode({ response, kind }), status: 'success', errorType: null, errorMessage: null }, guard),
        onItemSettled: async ({ index, alreadyDelivered, error, guard }) => {
            if (alreadyDelivered) { delivered.add(index); return; }
            await deliver(index, { status: 'failed', errorType: '生成失败',
                errorMessage: error?.message || '后台任务未生成图片，可编辑描述后重试' }, guard);
        },
        settlePlacements: async ({ error, guard }) => {
            if (!error) return;
            for (const item of items) if (!delivered.has(item.index)) {
                const existing = await getPreview(item.imgId);
                if (existing?.base64 || existing?.savedUrl) continue;
                await deliver(item.index, { status: 'failed', errorType: '后台任务已失效',
                    errorMessage: error.message || '任务未提交或已过期，可重试' }, guard);
            }
        },
        resolveSettlement: ({ error }) => ({ mode: error ? 'fail' : 'complete' }),
        afterForget: render,
    });
}

export function startComicJobRecovery(options) {
    let stopped = false, scanning = false;
    const active = new Map();
    const scan = async () => {
        if (stopped || scanning) return;
        scanning = true;
        try {
            const live = options.getContext();
            const farewells = readPageFarewells();
            for (const candidate of await listPendingImageJobs()) {
                if (stopped) break;
                if (candidate.provider !== 'novelai' || candidate.delivery.mode !== 'slots'
                    || String(candidate.delivery.chatId) !== String(live.chatId)
                    || !candidate.items.every(item => item.previewMetadata.comic) || active.has(candidate.jobId)) continue;
                const record = await claimPendingImageJob(candidate.jobId, {
                    farewell: findJobPageFarewell(farewells, candidate.jobId, candidate.leaseId),
                });
                if (!record) continue;
                const controller = new AbortController(); active.set(record.jobId, controller);
                void recoverComicRecord({ ...options, record, detachSignal: controller.signal })
                    .catch(error => { if (!stopped && !error.detached) console.warn('[Comic] 后台接回未完成:', error.message); })
                    .finally(() => active.delete(record.jobId));
            }
        } catch (error) { if (!stopped) console.warn('[Comic] 无法读取后台恢复记录:', error.message); }
        finally { scanning = false; }
    };
    const timer = setInterval(scan, 5000);
    void scan();
    return () => { stopped = true; clearInterval(timer); for (const controller of active.values()) controller.abort(); };
}
