import { createSceneSource } from '../../shared/scene-source.js';
import { compileNovelPromptForTask } from './compiler.js';

export function resolveCardPlannerSource(record, currentMessageText = '') {
    if (typeof record?.plannerSourceText === 'string') {
        return { text: record.plannerSourceText, origin: record.plannerSourceOrigin || 'captured' };
    }
    return { text: String(currentMessageText || ''), origin: 'current-message' };
}

export async function reparseNovelCardPrompt({ text, settings, preset, signal, parse }) {
    signal?.throwIfAborted();
    const sceneSource = createSceneSource(text);
    if (!sceneSource.content) throw new Error('原始描述不能为空');
    const tasks = await parse({ sceneSource, settings, preset: { ...preset, maxImages: 1 }, signal });
    signal?.throwIfAborted();
    if (!Array.isArray(tasks) || tasks.length !== 1 || !tasks[0]?.scene?.trim()) {
        throw new Error('重新解析必须返回一张图片的场景和角色 TAG');
    }
    const promptData = compileNovelPromptForTask(tasks[0], {
        positivePrefix: preset?.positivePrefix,
        negativePrefix: preset?.negativePrefix,
        knownCharacters: settings?.characterTags || [],
    });
    return {
        tags: tasks[0].scene,
        positive: promptData.scene,
        characterPrompts: promptData.characterPrompts.map((character, index) => ({
            ...character, name: tasks[0].chars?.[index]?.name || character.name || `角色 ${index + 1}`,
        })),
        negativePrompt: promptData.negativePrompt,
        plannerSourceText: String(text),
        plannerSourceOrigin: 'edited',
    };
}
