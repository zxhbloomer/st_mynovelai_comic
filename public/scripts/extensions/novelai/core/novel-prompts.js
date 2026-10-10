import { getNovelModelCapability, NOVEL_PROMPT_GUIDES } from './novel-model-capabilities.js';

export const PROMPT_TEMPLATE_VERSION = 14;
export const DEFAULT_PROMPT_CONFIG = Object.freeze({ topSystem: '', topSystemPov: '', sceneRules: '' });
const guides = new Map();
const guideFiles = Object.freeze({ [NOVEL_PROMPT_GUIDES.V45]: 'TAG编写指南-V4.5.md', [NOVEL_PROMPT_GUIDES.V5]: '提示词编写指南-V5.md' });

export function getNovelPromptGuideId(model) { return getNovelModelCapability(model).promptGuide; }
export function getNovelPlannerProfile(model) { const capability=getNovelModelCapability(model); return { imageModelName: capability.family === 'v5' ? 'NovelAI Diffusion V5' : 'NovelAI Diffusion V4.5', centerMode: capability.centerMode, interactSyntax: 'directional', ucScope: 'character' }; }
export function normalizeNovelPromptGuideOverrides(value) { const source=value && typeof value==='object' && !Array.isArray(value) ? value : {}; return Object.fromEntries(Object.values(NOVEL_PROMPT_GUIDES).filter(id=>typeof source[id]==='string').map(id=>[id,source[id]])); }
export function getLoadedTagGuideById(id) { return guides.get(id) || ''; }
export function getEffectiveNovelModelGuide(model, preset) { const id=getNovelPromptGuideId(model); const overrides=normalizeNovelPromptGuideOverrides(preset?.modelGuideOverrides); return Object.prototype.hasOwnProperty.call(overrides,id) ? overrides[id] : getLoadedTagGuideById(id); }
export function getPromptChainPreview(customPrompts, model) { return { profile: getNovelPlannerProfile(model), guide: getEffectiveNovelModelGuide(model, customPrompts) }; }
export async function loadTagGuide() { let ok=true; for (const [id,file] of Object.entries(guideFiles)) { try { const response=await fetch(new URL(`../${file}`, import.meta.url)); if (!response.ok) throw new Error(String(response.status)); guides.set(id, await response.text()); } catch { ok=false; } } return ok; }
export async function loadPromptTemplates() { return true; }
