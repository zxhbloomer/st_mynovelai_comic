import { redactRequestSecrets } from '../../agent-core/adapters/request-inspection.js';

const drawLogs = [];
let logSequence = 0;

// Memory only; never intercept unrelated console output or save account settings.
export function appendDrawLog(stage, details = {}, level = 'info') {
    try {
        const normalized = JSON.parse(JSON.stringify(details, (key, value) => value instanceof Error
            ? { name: value.name, message: value.message, stack: value.stack, code: value.code, status: value.status, cause: value.cause } : value));
        const text = JSON.stringify(redactRequestSecrets(normalized), null, 2)
            .replace(/Bearer\s+[^\s"\\]+/gi, 'Bearer [redacted]')
            .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
            .replace(/([?&](?:api_key|apiKey|token|key)=)[^&\s"]+/gi, '$1[redacted]');
        drawLogs.push({ id: ++logSequence, time: new Date().toISOString(), stage, level,
            details: text.length > 30000 ? text.slice(0, 30000) + '\n[内容过长，已截断]' : text });
        if (drawLogs.length > 100) drawLogs.shift();
    } catch { /* Logging must not interrupt image tasks. */ }
}

export function getDrawLogs() { return drawLogs.map(record => ({ ...record })); }
export function clearDrawLogs() { drawLogs.length = 0; }

// Use log, not the monitored error/warn channels or an intercepted module prefix.
// Planner diagnostics belong in F12 even when the LittleWhiteBox monitor is off.
export function logScenePlannerDiagnostic(label, details, logger = console) {
    appendDrawLog(`① LLM · ${label}`, details, label.includes('失败') || label.includes('未通过') ? 'error' : 'info');
    try {
        logger.log(`[Scene Planner] ${label}`, redactRequestSecrets(details));
        return true;
    } catch {
        // A console implementation must never interrupt generation or recovery.
        return false;
    }
}

export function logScenePlannerValidationFailure(failure, context = {}, logger = console) {
    let output = String(failure.modelOutput || '');
    try {
        output = JSON.parse(output);
    } catch {
        // A diagnostic from an older backend may contain a truncated JSON string.
    }
    return logScenePlannerDiagnostic('Tool 返回未通过校验', {
        event: 'scene_planner_tool_validation_failed',
        ...context,
        attempt: failure.attempt,
        startedAt: failure.startedAt,
        durationMs: failure.durationMs,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        errorPath: failure.errorPath,
        errorRule: failure.errorRule,
        received: failure.received,
        expected: failure.expected,
        llmResult: output,
        llmResultTruncated: failure.modelOutputTruncated === true,
    }, logger);
}

export function logScenePlannerArgumentsRepair(repair, context = {}, logger = console) {
    return logScenePlannerDiagnostic('已修复 Tool 参数末尾括号', {
        event: 'scene_planner_tool_arguments_repaired',
        ...context,
        ...repair,
    }, logger);
}
