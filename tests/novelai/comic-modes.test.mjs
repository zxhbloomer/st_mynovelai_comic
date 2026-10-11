import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImageBlock, serializeSectionImageProtocol } from '../../modules/draw/shared/comic-protocol.js';
import { createComicTasks, compileComicRules } from '../../modules/draw/shared/comic-planning.js';
import { compileNovelPromptForTask, buildNovelAIRequestBody } from '../../modules/draw/providers/novelai/compiler.js';
import { parseNovelPromptPresetImport } from '../../modules/draw/providers/novelai/novel-prompt-import.js';
const image = `@page
comic

@panel P1
room
@character C1
boy
@negative
glasses
@non_character
narration
Text: 她推开门。你好，世界！`;
test('full section protocol preserves character negatives, dialogue and roundtrip', () => {
 const p = parseImageBlock(image); assert.equal(p.ok, true);
 assert.equal(p.characters[0].negative, 'glasses');
 assert.match(p.base.prompt, /你好，世界！/);
 assert.deepEqual(parseImageBlock(serializeSectionImageProtocol(p.raw)).raw, p.raw);
});
test('inline uses reference paragraphs, identical pages remain independent and protocol stays out of prose', () => {
 const source='她推开门。\n\n他转身。';
 const response=`<manga_position>1</manga_position><image>${image}</image><manga_position>2</manga_position><image>${image}</image>`;
 const tasks=createComicTasks({ source, response, mode:'inline', maxImages:2 });
 assert.equal(tasks.length,2); assert.equal(tasks[0].placement.offset,6);
 assert.equal(tasks[1].placement.offset, source.length);
 assert.equal(tasks[0].comic.image, image); assert.notEqual(tasks[0].comic.page,tasks[1].comic.page);
 assert.equal(tasks[0].comic.sourceText,source);
 assert.throws(()=>createComicTasks({source,response,mode:'end'}),/位置/);
 assert.throws(()=>createComicTasks({source:'<div>正文</div>',response,mode:'inline'}),/段落/);
});
test('comic compilation preserves punctuation, bypasses character library and obeys explicit auto/manual coords',()=>{
 const task={comic:{image},scene:'ignored',chars:[{name:'wrong'}]};
 const p=compileNovelPromptForTask(task,{positivePrefix:'artist',negativePrefix:'bad'});
 assert.match(p.scene,/你好，世界！/); assert.match(p.scene,/^artist/);
 assert.equal(p.characterPrompts[0].prompt,'boy'); assert.equal(p.useCoords,false);
 for(const model of ['nai-diffusion-4-5-full','nai-diffusion-5-full']) {
  const params={model,width:832,height:1216,steps:28,scale:5,sampler:'k_euler',scheduler:'karras'};
  assert.equal(buildNovelAIRequestBody({...p,params,seed:1}).parameters.use_coords,false);
  assert.equal(buildNovelAIRequestBody({...p,useCoords:true,params,seed:1}).parameters.use_coords,true);
 }
});
test('rules compile reference macros locally without unresolved variables; mode persists in imported preset',()=>{
 const rules=compileComicRules(2); assert.ok(rules.length); assert.ok(rules.some(x=>x.content.includes('@page')));
 assert.ok(rules.every(x=>!x.content.includes('{{')));
 const payload={_type:'novel-draw-prompt-template',_version:3,topSystem:'',sceneRules:'',imageMode:'inline'};
 assert.equal(parseNovelPromptPresetImport(payload).imageMode,'inline');
 assert.equal(parseNovelPromptPresetImport({...payload,imageMode:undefined}).imageMode,'points');
});

test('editor draft saves separately and redraw captures a clean version', async () => {
 const { createComicDraft, comicForRedraw } = await import('../../modules/draw/shared/comic-edit-state.js');
 const original={version:1,mode:'end',page:1,image,planning:'original'};
 const edited=createComicDraft(original,image.replace('room','garden'),'edited');
 assert.equal(edited.image, image); assert.match(edited.draft.image,/garden/);
 const redraw=comicForRedraw(edited); assert.match(redraw.image,/garden/);
 assert.equal(redraw.planning,'edited'); assert.equal(redraw.draft,undefined);
 assert.equal(original.draft,undefined);
 assert.throws(()=>createComicDraft(original,'@page\ninvalid',''),/协议|缺少/);
});

test('inline/end append beside existing image slots without changing source or paragraph rules', async () => {
 const { insertScenePlacementsPreservingSlots } = await import('../../modules/draw/shared/scene-placement.js');
 const source='她推开门。\n[image:slot-old]\n\n他转身。';
 for (const mode of ['inline','end']) {
  const response=(mode==='inline'?'<manga_position>1</manga_position>':'')+`<image>${image}</image>`;
  const tasks=createComicTasks({source,response,mode});
  assert.doesNotMatch(tasks[0].comic.sourceText,/\[image:/);
  const placed=insertScenePlacementsPreservingSlots(source,tasks.map(task=>({placement:task.placement,content:'[image:slot-new]'})));
  assert.match(placed,/\[image:slot-old\]/); assert.match(placed,/\[image:slot-new\]/);
  if(mode==='end') assert.ok(placed.endsWith('[image:slot-new]'));
 }
});
