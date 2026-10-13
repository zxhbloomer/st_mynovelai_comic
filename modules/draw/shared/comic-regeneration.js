export async function regenerateComicFloor({ hasContent, confirm, collectFocus, clear, generate, overlay }) {
    if (hasContent && !(await confirm())) return { cancelled: true };
    const focus = await collectFocus();
    if (focus == null) return { cancelled: true };
    overlay?.show?.('正在生成中，请勿关闭页面');
    try {
        const cleared = await clear(focus);
        if (cleared === false) throw new Error('清空本楼层漫画失败，已停止生成');
        return { cancelled: false, result: await generate({ focus }) };
    } finally { overlay?.hide?.(); }
}
