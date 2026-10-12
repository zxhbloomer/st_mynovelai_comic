import { load, JSON_SCHEMA } from '../../../libs/js-yaml.mjs';

export function parseRequestBodyParams(raw = '') {
    if (!String(raw).trim()) return undefined;
    try {
        const parsed = load(String(raw), { schema: JSON_SCHEMA });
        const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
        if (isRecord(parsed)) return parsed;
        if (Array.isArray(parsed)) return Object.assign(Object.create(null), ...parsed.filter(isRecord));
        throw new Error('需要 YAML 对象或对象数组');
    } catch (error) {
        throw new Error(`附加主体参数解析失败：${error.message}`);
    }
}
