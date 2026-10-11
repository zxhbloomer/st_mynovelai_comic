import { getContext } from '../../../../../../extensions.js';
import { getPreviewsBySlot, getPreview, updatePreviewRecord, getPreviewDisplayUrl, setSlotSelection, storePreview } from './gallery-cache.js';
import { getDrawSavedEntry, syncDrawSavedFromPreview, clearDrawSavedEntry } from './draw-common.js';
import { parseImageBlock, readSectionImageData, serializeSectionImageProtocol } from './comic-protocol.js';
import { createComicDraft, comicForRedraw } from './comic-edit-state.js';
import { rewriteComic } from './comic-agent.js';

function element(tag, text, parent, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    parent?.append(node);
    return node;
}

export async function openComicEditor({ container, redraw, previewRequest, render }) {
    document.querySelector('.xb-comic-editor')?.dispatchEvent(new Event('comic-close'));
    const ctx = getContext(), message = ctx.chat?.[Number(container.dataset.mesid)];
    const chatId = String(ctx.chatId), swipeIndex = message?.swipe_id ?? 0;
    const slotId = container.dataset.slotId;
    let records = await getPreviewsBySlot(slotId);
    let record = records.find(row => row.imgId === container.dataset.imgId);
    if (!record) {
        const saved = getDrawSavedEntry(message, slotId);
        if (saved?.comic && saved.imgId === container.dataset.imgId) {
            record = { ...saved, messageId: Number(container.dataset.mesid), chatId,
                characterName: message?.name || '', status: 'success' };
            records = [record];
        }
    }
    if (!record?.comic) throw new Error('图片完整描述已丢失，无法打开新编辑器');
    let dirty = false, busy = false, generation = 0, rewriteController;
    const overlay = element('div', null, document.body, 'xb-comic-editor');
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '完整图片描述编辑');
    const dialog = element('div', null, overlay, 'xb-comic-dialog');
    const header = element('div', null, dialog, 'xb-comic-actions');
    element('h3', '图片描述编辑', header);
    const closeButton = element('button', '关闭', header);
    const columns = element('div', null, dialog, 'xb-comic-columns');
    const left = element('div', null, columns);
    const image = element('img', null, left, 'xb-comic-preview'); image.alt = '当前图片版本';
    const historyLabel = element('label', '历史版本', left);
    const history = element('select', null, historyLabel);
    for (const row of records) {
        const option = element('option', new Date(row.timestamp || Date.now()).toLocaleString() + (row.status === 'success' ? '' : ` · ${row.status}`), history);
        option.value = row.imgId;
    }
    const actual = element('details', null, left);
    element('summary', '该图片实际生成设置', actual);
    const actualText = element('pre', null, actual);
    const right = element('div', null, columns);
    const planningLabel = element('label', '本页规划（可选）', right);
    const planning = element('textarea', null, planningLabel); planning.rows = 4;
    const rawLabel = element('label', '完整分段生成描述', right);
    const raw = element('textarea', null, rawLabel); raw.rows = 15; raw.spellcheck = false;
    const forms = element('div', null, right, 'xb-comic-forms');
    const request = element('details', null, right);
    element('summary', '当前设置下的绘图请求预览', request);
    const requestText = element('pre', null, request);
    const requirementLabel = element('label', 'AI 改写要求', dialog);
    const requirement = element('textarea', null, requirementLabel); requirement.rows = 2;
    const status = element('div', '', dialog, 'xb-comic-status'); status.setAttribute('role', 'status');
    const actions = element('div', null, dialog, 'xb-comic-actions');
    const rewriteButton = element('button', 'AI 改写', actions);
    const saveButton = element('button', '保存描述', actions);
    const redrawButton = element('button', '保存并重画', actions);
    const downloadButton = element('button', '下载图片', actions);
    const initialFocus = document.activeElement;
    const assertOwner = () => {
        const live = getContext();
        if (String(live.chatId) !== chatId || !live.chat?.includes(message)
            || (message.swipe_id ?? 0) !== swipeIndex) throw new Error('聊天或消息分支已切换，请重新打开编辑器');
    };
    function close(force = false) {
        if (!force && dirty && !confirm('编辑内容尚未保存，确定关闭？')) return;
        generation++; rewriteController?.abort(); overlay.remove();
        document.removeEventListener('keydown', onKey); initialFocus?.focus();
    }
    function onKey(event) {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'Tab') {
            const focusable = [...dialog.querySelectorAll('button,textarea,input,select,summary')].filter(node => !node.disabled);
            const first = focusable[0], last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    }
    document.addEventListener('keydown', onKey);
    closeButton.addEventListener('click', () => close());
    overlay.addEventListener('comic-close', () => close(true));
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    function updatePreview() {
        try { requestText.textContent = JSON.stringify(previewRequest({ ...record.comic, image: raw.value }), null, 2); }
        catch (error) { requestText.textContent = error.message; }
    }
    function field(parent, title, object, key, { numeric = false, single = false } = {}) {
        const label = element('label', title, parent);
        const input = element(numeric || single ? 'input' : 'textarea', null, label);
        input.value = object[key] ?? ''; if (input.tagName === 'TEXTAREA') input.rows = 3;
        if (numeric) { input.type = 'number'; input.min = '0'; input.max = '1'; input.step = '0.01'; }
        input.addEventListener('input', () => {
            object[key] = numeric ? (input.value === '' ? NaN : Number(input.value)) : input.value;
            raw.value = serializeSectionImageProtocol(data); dirty = true; updatePreview();
        });
    }
    let data;
    function syncForms() {
        const parsed = readSectionImageData(raw.value);
        forms.replaceChildren();
        if (!parsed.ok) { status.textContent = parsed.reason; updatePreview(); return; }
        data = parsed.data;
        field(forms, '页面正面描述', data.page, 'base');
        field(forms, '页面非人物内容／文字', data.page, 'non_character');
        const modeLabel = element('label', '角色定位', forms);
        const mode = element('select', null, modeLabel);
        for (const [value, text] of [['auto', '自动'], ['manual', '手动']]) {
            const option = element('option', text, mode); option.value = value;
        }
        mode.value = data.position_mode || 'auto';
        mode.addEventListener('change', () => {
            if (mode.value === 'manual') {
                data.position_mode = 'manual';
                data.panels.forEach(p => p.characters.forEach(c => { c.center ||= { x: 0.5, y: 0.5 }; }));
            } else delete data.position_mode;
            raw.value = serializeSectionImageProtocol(data); dirty = true; syncForms();
        });
        for (const panel of data.panels) {
            const group = element('fieldset', null, forms);
            element('legend', `画格 ${panel.id}`, group);
            field(group, '画格编号', panel, 'id', { single: true });
            field(group, '画格描述', panel, 'description');
            field(group, '非人物内容／文字', panel, 'non_character');
            for (const character of panel.characters) {
                const charGroup = element('fieldset', null, group);
                element('legend', `人物 ${character.character_id}`, charGroup);
                field(charGroup, '人物编号', character, 'character_id', { single: true });
                field(charGroup, '人物正面词', character, 'positive');
                field(charGroup, '人物负面词', character, 'negative');
                if (data.position_mode === 'manual') {
                    character.center ||= { x: 0.5, y: 0.5 };
                    field(charGroup, '中心 X（0～1）', character.center, 'x', { numeric: true });
                    field(charGroup, '中心 Y（0～1）', character.center, 'y', { numeric: true });
                }
            }
        }
        const validated = parseImageBlock(raw.value);
        status.textContent = validated.ok ? '' : validated.reason;
        updatePreview();
    }
    function load(selected) {
        record = selected; history.value = record.imgId;
        raw.value = record.comic.draft?.image ?? record.comic.image;
        planning.value = record.comic.draft?.planning ?? record.comic.planning ?? '';
        const url = getPreviewDisplayUrl(record); image.hidden = !url;
        if (url) image.src = url; else image.removeAttribute('src');
        actualText.textContent = JSON.stringify(record.generationSnapshot || {}, null, 2);
        dirty = false; syncForms();
    }
    raw.addEventListener('input', () => { dirty = true; syncForms(); });
    planning.addEventListener('input', () => { dirty = true; });
    history.addEventListener('change', async () => {
        const selected = records.find(row => row.imgId === history.value);
        if (busy || dirty && !confirm('切换版本将放弃未保存编辑，是否继续？')) { history.value = record.imgId; return; }
        try {
            assertOwner();
            if (!selected?.comic) throw new Error('该版本没有完整生成描述');
            load(selected); await setSlotSelection(slotId, record.imgId);
            const liveId = getContext().chat.indexOf(message);
            if (record.savedUrl) await syncDrawSavedFromPreview(liveId, record);
            else await clearDrawSavedEntry(liveId, slotId);
            await render();
        } catch (error) { status.textContent = error.message; }
    });
    async function save() {
        assertOwner();
        const existing = await getPreview(record.imgId);
        if (!existing) {
            const saved = getDrawSavedEntry(message, slotId);
            if (saved?.imgId !== record.imgId || !saved.comic) throw new Error('图片已删除，未保存描述');
            await storePreview(record);
        }
        const comic = createComicDraft(record.comic, raw.value, planning.value);
        await updatePreviewRecord(record.imgId, { comic });
        record.comic = comic; dirty = false;
        if (record.savedUrl) {
            const liveId = getContext().chat.indexOf(message);
            if (getDrawSavedEntry(message, slotId)?.imgId === record.imgId) await syncDrawSavedFromPreview(liveId, record);
        }
        status.textContent = '描述已保存，图片实际生成依据保持不变';
    }
    async function action(operation) {
        if (busy) return;
        busy = true; history.disabled = true;
        for (const button of [rewriteButton, saveButton, redrawButton]) button.disabled = true;
        try { await operation(); }
        catch (error) { if (overlay.isConnected) status.textContent = error.message; }
        finally {
            busy = false; history.disabled = false;
            for (const button of [rewriteButton, saveButton, redrawButton]) button.disabled = false;
        }
    }
    saveButton.addEventListener('click', () => action(save));
    redrawButton.addEventListener('click', () => action(async () => {
        await save();
        await redraw(record, comicForRedraw(record.comic));
        close(true);
    }));
    rewriteButton.addEventListener('click', () => action(async () => {
        assertOwner();
        const snapshot = comicForRedraw(createComicDraft(record.comic, raw.value, planning.value));
        const expected = raw.value, expectedPlanning = planning.value, epoch = ++generation;
        rewriteController = new AbortController(); status.textContent = '正在 AI 改写…';
        const result = await rewriteComic(snapshot, requirement.value, { signal: rewriteController.signal });
        if (!overlay.isConnected || generation !== epoch) return;
        assertOwner();
        if (raw.value !== expected || planning.value !== expectedPlanning) throw new Error('等待期间编辑内容已变化，未覆盖当前草稿');
        raw.value = result.image; planning.value = result.planning; dirty = true;
        syncForms(); status.textContent = 'AI 改写已回填草稿，请审阅后保存或重画';
    }));
    downloadButton.addEventListener('click', () => {
        const url = getPreviewDisplayUrl(record);
        if (!url) { status.textContent = '当前版本没有可下载图片'; return; }
        const link = element('a'); link.href = url; link.download = `${record.imgId}.png`; link.click();
    });
    load(record); closeButton.focus();
    return true;
}
