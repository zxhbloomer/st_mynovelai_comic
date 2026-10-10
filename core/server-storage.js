import { getRequestHeaders } from '../../../../../script.js';
import { debounce } from '../../../../utils.js';
import { StorageFile } from './storage-file.js';

const createStorage = (filename, opts = {}) => new StorageFile(filename, {
    ...opts,
    getRequestHeaders,
    debounce,
});

export const TasksStorage = createStorage('HuaManhua_Tasks.json');
export const StoryOutlineStorage = createStorage('HuaManhua_StoryOutline.json');
export const NovelDrawStorage = createStorage('HuaManhua_NovelDraw.json', { debounceMs: 800 });
export const SdDrawStorage = createStorage('HuaManhua_SdDraw.json', { debounceMs: 800 });
export const ComfyDrawStorage = createStorage('HuaManhua_ComfyDraw.json', { debounceMs: 800 });
export const AssistantStorage = createStorage('HuaManhua_Assistant.json', { debounceMs: 800 });
export const TtsStorage = createStorage('HuaManhua_TTS.json', { debounceMs: 800 });
export const EnaPlannerStorage = createStorage('HuaManhua_EnaPlanner.json', { debounceMs: 800 });
export const CommonSettingStorage = createStorage('HuaManhua_CommonSettings.json', { debounceMs: 1000 });
export const VectorStorage = createStorage('HuaManhua_Vectors.json', { debounceMs: 3000 });

