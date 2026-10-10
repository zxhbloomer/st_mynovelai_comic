const PARAM_KEYS = [
    'model', 'sampler', 'scheduler', 'steps', 'scale', 'width', 'height', 'seed',
    'qualityToggle', 'autoSmea', 'ucPreset', 'cfg_rescale', 'variety_boost',
    'sm', 'sm_dyn', 'decrisper', 'v5QualityPresetId', 'v5UcPresetId', 'transparentBackground',
];

// Persist generation parameters only; connection settings and credentials stay live.
export function captureNovelGenerationSnapshot(preset, payload) {
    const params = {};
    for (const key of PARAM_KEYS) {
        const value = preset?.params?.[key];
        if (['string', 'number', 'boolean'].includes(typeof value)) params[key] = value;
    }
    params.model = payload.model;
    for (const key of ['width', 'height', 'seed', 'steps', 'scale', 'sampler', 'cfg_rescale']) {
        if (payload.parameters[key] !== undefined) params[key] = payload.parameters[key];
    }
    if (payload.parameters.noise_schedule !== undefined) params.scheduler = payload.parameters.noise_schedule;
    return {
        version: 1,
        provider: 'novelai',
        presetId: String(preset?.id || ''),
        presetName: String(preset?.name || ''),
        positivePrefix: String(preset?.positivePrefix || ''),
        negativePrefix: String(preset?.negativePrefix || ''),
        params,
    };
}

export function resolveNovelRedrawConfig(settings, preset, snapshot) {
    if (snapshot?.provider !== 'novelai' || snapshot.version !== 1 || !snapshot.params) return { settings, preset };
    return {
        settings: { ...settings, overrideSize: 'default' },
        preset: {
            id: snapshot.presetId,
            name: snapshot.presetName,
            positivePrefix: snapshot.positivePrefix,
            negativePrefix: snapshot.negativePrefix,
            params: { ...snapshot.params },
        },
    };
}

export function describeNovelGenerationSnapshot(snapshot) {
    if (snapshot?.provider !== 'novelai' || snapshot.version !== 1 || !snapshot.params) {
        return '旧图未记录生成配置，重绘使用当前预设和尺寸。';
    }
    const p = snapshot.params;
    return `预设：${snapshot.presetName || '未命名'} · 尺寸：${p.width} × ${p.height}\n`
        + `模型：${p.model} · 采样：${p.sampler} · 调度：${p.scheduler}\n`
        + `步数：${p.steps} · Prompt Guidance：${p.scale} · Rescale：${p.cfg_rescale ?? '不适用'} · 种子：${p.seed}\n`
        + '重绘沿用此图参数；连接和密钥使用当前设置。';
}
