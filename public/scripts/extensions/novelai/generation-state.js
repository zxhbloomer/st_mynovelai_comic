export function cancelNovelAIGeneration() { globalThis.__stNovelAIAbortController?.abort(); }
export function isNovelAIGenerationActive() { return Boolean(globalThis.__stNovelAIAbortController); }
