const fields = ['topSystem', 'sceneRules'];

export function normalizePromptRows(rows) {
    if (!Array.isArray(rows)) throw new TypeError('提示词组必须是列表');
    return rows.map((row, index) => {
        if (!row || typeof row.title !== 'string' || typeof row.content !== 'string') throw new TypeError('提示词必须包含标题和正文');
        return { id: String(row.id || `row-${index}`), title: row.title, content: row.content };
    });
}

export function normalizePromptGroups(value, preset = {}) {
    if (value != null && (typeof value !== 'object' || Array.isArray(value))) throw new TypeError('提示词组格式无效');
    const source = value || {};
    if (source.modelGuides != null && (typeof source.modelGuides !== 'object' || Array.isArray(source.modelGuides))) throw new TypeError('模型指南组格式无效');
    const result = { modelGuides: {} };
    for (const key of fields) result[key] = key in source ? normalizePromptRows(source[key])
        : [{ id: `${key}-legacy`, title: '', content: String(preset[key] || '') }];
    for (const [key, rows] of Object.entries(source.modelGuides || {})) result.modelGuides[key] = normalizePromptRows(rows);
    return result;
}

export function joinPromptRows(rows) {
    return normalizePromptRows(rows).filter(row => row.content.trim()).map(row =>
        (row.title.trim() ? `### ${row.title.trim()}\n` : '') + row.content).join('\n\n');
}

export function applyPromptGroups(preset) {
    if (!preset?.promptGroups) return preset;
    const promptGroups = normalizePromptGroups(preset.promptGroups, preset);
    return { ...preset, promptGroups, topSystem: joinPromptRows(promptGroups.topSystem),
        sceneRules: joinPromptRows(promptGroups.sceneRules), modelGuideOverrides: {
            ...preset.modelGuideOverrides,
            ...Object.fromEntries(Object.entries(promptGroups.modelGuides).map(([id, rows]) => [id, joinPromptRows(rows)])),
        } };
}
