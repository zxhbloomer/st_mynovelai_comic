import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const driver = process.env.COMIC_PLAYWRIGHT_DRIVER || path.resolve('../文生图工具v1/test-driver');
const { chromium } = require(driver);
const root = path.resolve(import.meta.dirname, '../..');
const prefix = '/scripts/extensions/third-party/st_mynovelai_comic/';
const image = '@page\ncomic\n\n@panel P1\nroom\n@character C1\nboy\n@negative\nglasses\n@non_character\nnarration\nText: 你好，世界！';
const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=';
const host = {
 '/script.js': 'export const messageFormatting=text=>text;',
 '/scripts/extensions.js': 'export const getContext=()=>window.ctx;',
 '/scripts/utils.js': 'export const saveBase64AsFile=async()=>"/saved.png"; export const uuidv4=()=>crypto.randomUUID();',
 [prefix+'core/event-manager.js']: 'export const event_types={};export const createModuleEvents=()=>({on(){},off(){},emit(){}});',
 [prefix+'modules/shared/common/generate-interceptor.js']: 'export const GENERATE_INTERCEPTOR_ORDER={};export function registerGenerateInterceptor(){} export function unregisterGenerateInterceptor(){}',
 [prefix+'modules/draw/shared/draw-agent.js']: 'export const resolveDrawAgentContext=async()=>({providerConfig:{maxTokens:4000},agentCore:{createAgentAdapter:()=>({chat:async task=>{window.llmTask=task;return {text:window.llmResponse};}})}});',
};
async function harness() {
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost').pathname;
  if(url==='/') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><link rel="stylesheet" href="'+prefix+'style.css"></head><body></body></html>');return;}
  const file=path.resolve(root,decodeURIComponent(url.slice(prefix.length)));
  if(host[url]) {res.setHeader('Content-Type','text/javascript');res.end(host[url]);return;}
  if(url.startsWith(prefix)&&file.startsWith(root+path.sep)&&fs.existsSync(file)) {res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(file));return;}
  res.statusCode=404;res.end(url);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try {browser=await chromium.launch({headless:true,...(process.env.COMIC_BROWSER_EXE?{executablePath:process.env.COMIC_BROWSER_EXE}:{})});}
 catch(error){await new Promise(resolve=>server.close(resolve));throw error;}
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 return {page,errors,close:async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));}};
}

test('real IndexedDB, history editor, AI draft and reload preserve per-version protocol',async()=>{
 const h=await harness();const {page}=h;
 try {
  await page.evaluate(async({prefix,image,base64})=>{
   window.ctx={chatId:'chat',chat:[{mes:'原正文[image:slot-test]',name:'test',swipe_id:0,extra:{}}],saveChat:async()=>{}};
   const gallery=await import(prefix+'modules/draw/shared/gallery-cache.js');window.gallery=gallery;
   const common=await import(prefix+'modules/draw/shared/draw-common.js');window.common=common;
   const planning=await import(prefix+'modules/draw/shared/comic-planning.js');
   const editor=await import(prefix+'modules/draw/shared/comic-editor.js');window.editor=editor;
   const comic={version:1,mode:'end',page:1,image,sourceText:'旧正文',pages:[{page:1,image,planning:''}]};
   await gallery.storePreview({imgId:'img-a',slotId:'slot-test',base64,comic,tags:image,chatId:'chat',messageId:0});
   await gallery.updatePreviewSavedUrl('img-a','/img-a.png');
   await gallery.storePreview({imgId:'img-b',slotId:'slot-test',base64,comic:{...comic,image:image.replace('room','garden')},tags:image,chatId:'chat',messageId:0});
   await gallery.updatePreviewSavedUrl('img-b','/img-b.png');
   await common.syncDrawSavedFromPreview(0,await gallery.getPreview('img-b'));
   window.ctx.chat[0].mes='用户修改后的正文[image:slot-test]';
   const container=document.createElement('div');container.dataset.imgId='img-a';container.dataset.slotId='slot-test';container.dataset.mesid='0';document.body.append(container);window.card=container;
   window.openEditor=()=>editor.openComicEditor({container,previewRequest:comic=>planning.compileComicPrompt(comic),render:async()=>{},redraw:async(record,comic)=>{window.redrawn={record:record.imgId,comic,source:window.ctx.chat[0].mes};}});
   await window.openEditor();
  },{prefix,image,base64});
  const raw=page.locator('.xb-comic-dialog label').filter({hasText:'完整分段生成描述'}).locator('textarea');
  assert.equal(await raw.inputValue(),image);
  const positive=page.locator('.xb-comic-forms label').filter({hasText:'人物正面词'}).locator('textarea');
  await positive.fill('boy, hat');assert.match(await raw.inputValue(),/boy, hat/);
  await page.getByRole('button',{name:'保存描述',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.xb-comic-status').textContent.includes('已保存'));
  const saved=await page.evaluate(()=>window.gallery.getPreview('img-a'));
  assert.equal(saved.comic.image,image);assert.match(saved.comic.draft.image,/boy, hat/);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.evaluate(()=>window.openEditor());assert.match(await raw.inputValue(),/boy, hat/);
  await page.locator('.xb-comic-dialog select').first().selectOption('img-b');assert.match(await raw.inputValue(),/garden/);
  await page.locator('.xb-comic-dialog select').first().selectOption('img-a');
  await page.waitForFunction(()=>window.common.getDrawSavedEntry(window.ctx.chat[0],'slot-test')?.imgId==='img-a');
  await page.evaluate(({image})=>{window.llmResponse=`<comic_plan>本页优化</comic_plan><image>${image.replace('room','forest')}</image>`;},{image});
  await page.getByRole('button',{name:'AI 改写',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.xb-comic-status').textContent.includes('已回填'));
  assert.match(await raw.inputValue(),/forest/);
  assert.equal((await page.evaluate(()=>window.gallery.getPreview('img-a'))).comic.image,image);
  await page.getByRole('button',{name:'保存并重画',exact:true}).click();
  await page.waitForFunction(()=>!!window.redrawn);
  const redrawn=await page.evaluate(()=>window.redrawn);assert.match(redrawn.comic.image,/forest/);assert.equal(redrawn.comic.draft,undefined);
  assert.equal(redrawn.source,'用户修改后的正文[image:slot-test]');
  await page.reload();
  const restored=await page.evaluate(async prefix=>{window.ctx={chatId:'chat'};const gallery=await import(prefix+'modules/draw/shared/gallery-cache.js');return gallery.getPreview('img-a');},prefix);
  assert.equal(restored.comic.image,image);assert.match(restored.comic.draft.image,/forest/);
  assert.deepEqual(h.errors,[]);
 } finally {await h.close();}
});


test('front/backend prepared slots persist full descriptions before transport and never write protocol into prose',async()=>{
 const h=await harness();
 try {
  const result=await h.page.evaluate(async({prefix,image,base64})=>{
   const gallery=await import(prefix+'modules/draw/shared/gallery-cache.js');
   const {createComicTasks}=await import(prefix+'modules/draw/shared/comic-planning.js');
   const {submitPreparedChatImages}=await import(prefix+'modules/draw/shared/prepared-chat-images.js');
   const {prepareImageInput}=await import(prefix+'modules/draw/shared/prepared-image-input.js');
   const originalFetch=window.fetch;
   const summary=[];
   for(const backend of [false,true]) {
    const source='她推开门。\n\n他转身。';const message={mes:source,name:'test',swipe_id:0};
    window.ctx={chatId:'chat',groupId:'group',chat:[message],getRequestHeaders:()=>({}),
     saveChat:async()=>{window.persisted=JSON.parse(JSON.stringify(window.ctx.chat));}};
    window.fetch=async(url,...args)=>url==='/api/chats/group/get'?new Response(JSON.stringify(window.persisted),{headers:{'Content-Type':'application/json'}}):originalFetch(url,...args);
    const response=`<manga_position>1</manga_position><image>${image}</image><manga_position>2</manga_position><image>${image}</image>`;
    const tasks=createComicTasks({source,response,mode:'inline',maxImages:2});
    const recipe={params:{model:'nai-diffusion-4-5-full',width:832,height:1216},defaultParams:{},seeds:[1,2],timeout:1000,
     requestDelay:{min:0,max:0},autoLearnEnabled:false,autoLearnMode:'new_only',apiBaseUrl:'https://image.novelai.net'};
    const {metadata}=prepareImageInput('novelai',tasks,recipe);
    const output=await submitPreparedChatImages({ctx:window.ctx,message,messageId:0,sourceText:source,tasks,metadata,backend,
     onStateChange:()=>{},run:async handlers=>{
      if(backend) await handlers.recoverable.commitPlacements();
      const plan=handlers.recoverable.plan;
      for(const row of plan.items) {
       const stored=await gallery.getPreview(row.imgId);
       if(stored.comic.image!==image||stored.status!=='pending') throw new Error('description missing before drawing');
      }
      const first = await gallery.getPreview(plan.items[0].imgId);
      await gallery.updatePreviewRecord(first.imgId, {comic:{...first.comic,draft:{image:image.replace('room','saved-edit'),planning:'draft'}}});
      await handlers.onItemReady({index:0,base64});
      if (!(await gallery.getPreview(first.imgId)).comic.draft?.image.includes('saved-edit')) throw new Error('saved draft overwritten');
      // Removing the second slot while the request runs must prevent resurrection.
      message.mes=message.mes.replace(`[image:${plan.items[1].slotId}]`,'');
      await handlers.onItemReady({index:1,base64});
      window.lastPlan=plan;
     }});
    const plan=window.lastPlan;
    summary.push({backend,success:output.success,mes:message.mes,
     first:(await gallery.getPreview(plan.items[0].imgId)).comic.image,
     removed:await gallery.getPreview(plan.items[1].imgId)});
   }
   window.fetch=originalFetch;return summary;
  },{prefix,image,base64});
  for(const row of result){assert.equal(row.success,1);assert.equal(row.first,image);assert.equal(row.removed,undefined);assert.doesNotMatch(row.mes,/<image>|@page|manga_position/);assert.match(row.mes,/她推开门/);}
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

test('journal roundtrip and recovery deliver exact protocol; deleted slots discard results without new submission',async()=>{
 const h=await harness();
 try {
  const result=await h.page.evaluate(async({prefix,image,base64})=>{
   window.ctx={chatId:'chat',chat:[{mes:'新正文[image:slot-test]',name:'test',swipe_id:0}]};
   const gallery=await import(prefix+'modules/draw/shared/gallery-cache.js');
   const journal=await import(prefix+'modules/draw/shared/pending-image-jobs.js');
   const {recoverComicRecord}=await import(prefix+'modules/draw/shared/comic-job-recovery.js');
   const comic={version:1,mode:'end',page:1,image,sourceText:'生成时正文'};
   const input={jobId:'comic-test-job',provider:'novelai',delivery:{mode:'slots',chatId:'chat',messageId:'0',swipeIndex:0},
    gallery:{chatId:'chat',messageId:'0',characterName:'test'},items:[{index:0,slotId:'slot-test',imgId:'img-recovery',previewMetadata:{tags:image,comic}}]};
   const saved=await journal.recordPendingImageJob(input);
   const record=await journal.getPendingImageJob(saved.jobId);
   const options={record,client:{},getContext:()=>window.ctx,decode:async()=>base64,
    store:gallery.storePreview,remove:gallery.deletePreview,select:gallery.setSlotSelection,
    clearSelection:gallery.clearSlotSelection,getPreview:gallery.getPreview,render:async()=>{},
    reattach:async handlers=>{await handlers.onItemReady({index:0,response:{},kind:'png',guard:async()=>record});}};
   await recoverComicRecord(options);const delivered=await gallery.getPreview('img-recovery');
   await recoverComicRecord({...options,reattach:async handlers=>handlers.settlePlacements({error:new Error('job_not_found'),guard:async()=>record})});
   if ((await gallery.getPreview('img-recovery')).base64 !== base64) throw new Error('expired journal erased successful image');
   const portable=await gallery.exportPortablePreviewsForSlots(['slot-test']);
   await gallery.deletePreview('img-recovery');
   await gallery.importPortablePreviews(portable.previews,portable.selections);
   const imported=await gallery.getPreview('img-recovery');
   window.ctx.chat[0].mes='图片槽已删';await recoverComicRecord(options);
   const removed=await gallery.getPreview('img-recovery');
   await journal.forgetPendingImageJob(record.jobId,record.leaseId);
   return {record,delivered,imported,removed};
  },{prefix,image,base64});
  assert.equal(result.record.items[0].previewMetadata.comic.image,image);
  assert.equal(result.delivered.comic.image,image);assert.equal(result.imported.comic.image,image);assert.equal(result.removed,undefined);
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

test('saved fallback and shared deletion retain another version, then remove last comic slot',async()=>{
 const h=await harness();
 try {
  const result=await h.page.evaluate(async({prefix,image,base64})=>{
   const gallery=await import(prefix+'modules/draw/shared/gallery-cache.js');
   const common=await import(prefix+'modules/draw/shared/draw-common.js');
   const actions=await import(prefix+'modules/draw/shared/image-card-actions.js');
   window.ctx={chatId:'chat',groupId:'group',chat:[{mes:'正文[image:slot-test]',name:'test',swipe_id:0,extra:{}}],getRequestHeaders:()=>({}),saveChat:async()=>{window.persisted=JSON.parse(JSON.stringify(window.ctx.chat));}};
   const originalFetch=window.fetch;
   window.fetch=async(url,...args)=>url==='/api/chats/group/get'?new Response(JSON.stringify(window.persisted),{headers:{'Content-Type':'application/json'}}):originalFetch(url,...args);
   const comic={version:1,mode:'end',page:1,image,sourceText:'正文'};
   for(const id of ['img-a','img-b']) await gallery.storePreview({imgId:id,slotId:'slot-test',base64,savedUrl:'/'+id+'.png',comic,tags:image,chatId:'chat',messageId:0});
   await common.syncDrawSavedFromPreview(0,await gallery.getPreview('img-b'));
   await actions.deleteImageVersion({imgId:'img-b'});
   const remaining=await gallery.getPreviewsBySlot('slot-test');
   const afterDelete=common.getDrawSavedEntry(window.ctx.chat[0],'slot-test');
   await gallery.clearAllCache();
   const fallback=await common.getDrawImageRecord(window.ctx.chat[0],'slot-test');
   const prepared=await import(prefix+'modules/draw/shared/prepared-chat-images.js');
   let redrawInput;
   const dispose=prepared.registerPreparedImageProvider('novelai',async input=>{redrawInput=input;return {};});
   await actions.redrawImageCard('novelai',{dataset:{imgId:'img-a',slotId:'slot-test',mesid:'0'}});
   if(redrawInput.tasks[0].comic.image!==image||redrawInput.generationSnapshot) throw new Error('saved fallback redraw lost description');
   dispose();
   await actions.deleteImageVersion({imgId:'img-a',slotId:'slot-test',messageId:0});
   window.fetch=originalFetch;
   return {remaining:remaining.map(row=>row.imgId),afterDelete,fallback,body:window.ctx.chat[0].mes,saved:common.getDrawSavedEntry(window.ctx.chat[0],'slot-test'),records:await gallery.getPreviewsBySlot('slot-test')};
  },{prefix,image,base64});
  assert.deepEqual(result.remaining,['img-a']); assert.equal(result.afterDelete.imgId,'img-a');
  assert.equal(result.fallback.comic.image,image); assert.equal(result.fallback.savedUrl,'/img-a.png');
  assert.equal(result.saved,null); assert.doesNotMatch(result.body,/\[image:/); assert.deepEqual(result.records,[]);
  assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});

test('deleting an unselected version preserves selection; legacy last deletion retains its slot',async()=>{
 const h=await harness();
 try {
  const result=await h.page.evaluate(async({prefix,image,base64})=>{
   const gallery=await import(prefix+'modules/draw/shared/gallery-cache.js');
   const common=await import(prefix+'modules/draw/shared/draw-common.js');
   const actions=await import(prefix+'modules/draw/shared/image-card-actions.js');
   window.ctx={chatId:'chat',chat:[{mes:'正文[image:slot-test]',name:'test',swipe_id:0,extra:{}}],saveChat:async()=>{}};
   const comic={version:1,mode:'end',page:1,image,sourceText:'正文'};
   for(const id of ['img-a','img-b','img-c']) await gallery.storePreview({imgId:id,slotId:'slot-test',base64,savedUrl:'/'+id+'.png',comic,tags:image,chatId:'chat',messageId:0});
   await gallery.setSlotSelection('slot-test','img-a');
   await common.syncDrawSavedFromPreview(0,await gallery.getPreview('img-a'));
   await actions.deleteImageVersion({imgId:'img-c'});
   const selected=await gallery.getSlotSelection('slot-test');
   const saved=common.getDrawSavedEntry(window.ctx.chat[0],'slot-test');
   await gallery.clearAllCache();
   window.ctx.chat[0].extra={};
   await gallery.storePreview({imgId:'legacy',slotId:'slot-test',base64,savedUrl:'/legacy.png',tags:'room',chatId:'chat',messageId:0});
   await common.syncDrawSavedFromPreview(0,await gallery.getPreview('legacy'));
   await actions.deleteImageVersion({imgId:'legacy'});
   return {selected,saved,body:window.ctx.chat[0].mes,legacySaved:common.getDrawSavedEntry(window.ctx.chat[0],'slot-test')};
  },{prefix,image,base64});
  assert.equal(result.selected,'img-a');assert.equal(result.saved.imgId,'img-a');
  assert.match(result.body,/\[image:slot-test\]/);assert.equal(result.legacySaved,null);
 }finally{await h.close();}
});


test('three prompt group UI retains drafts per preset/model, exports structure and restores defaults',async()=>{
 const h=await harness();
 try {
  await h.page.route('https://**/*',route=>route.abort());
  await h.page.route('**/draw-usage.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await h.page.evaluate(prefix=>{const f=document.createElement('iframe');f.id='settings-test';f.src=prefix+'modules/draw/providers/novelai/novel-draw.html';f.style.cssText='width:100%;height:850px';document.body.append(f);window.addEventListener('message',e=>{window.lastSettingsMessage=e.data;});},prefix);
  const f=h.page.frameLocator('#settings-test');
  await f.locator('[data-add-prompt="topSystem"]').waitFor({state:'attached'});
  const actual=h.page.frames().find(frame=>frame.url().includes('novel-draw.html'));
  await actual.waitForLoadState('domcontentloaded');
  const {getNovelModelCapabilitiesForUi}=await import('../../modules/draw/providers/novelai/novel-model-capabilities.js');
  await actual.evaluate(capabilities=>{state.modelCapabilities=capabilities;state.promptPresets=[{id:'a',name:'A',topSystem:'原文',sceneRules:'规则',modelGuideOverrides:{}},{id:'b',name:'B',topSystem:'另一预设',sceneRules:'另一规则',modelGuideOverrides:{}}];state.selectedPromptPresetId='a';state.modelGuideDefaults={'v4.5':'默认指南',v5:'V5指南'};applyStateToUI();switchView('prompts');},getNovelModelCapabilitiesForUi());
  await f.locator('#nd_prompt_system_group summary').first().click();
  await f.locator('[data-add-prompt="topSystem"]').click();
  assert.equal(await f.locator('#nd_prompt_system_group details').first().evaluate(el=>el.open),true);
  assert.equal(await f.locator('#nd_prompt_system_group details').last().evaluate(el=>el.open),false);
  await f.locator('#nd_prompt_system_group summary').last().click();
  await f.locator('#nd_prompt_system_group input[type="text"], #nd_prompt_system_group input:not([type])').last().fill('新增标题');
  await f.locator('#nd_prompt_system_group textarea').last().fill('新增正文');
  await f.locator('#nd_collapse_images').check();
  await f.locator('#nd_prompt_preset_save').click();
  await h.page.waitForFunction(()=>window.lastSettingsMessage?.type==='SAVE_PROMPT_PRESET');
  const saved=await h.page.evaluate(()=>window.lastSettingsMessage.promptDraft);
  assert.equal(saved.promptGroups.topSystem.length,2);assert.equal(saved.collapseImages,true);assert.match(saved.topSystem,/新增标题\n新增正文/);
  await actual.evaluate(()=>{state.selectedPromptPresetId='b';applyPromptPreset();state.selectedPromptPresetId='a';applyPromptPreset();});
  assert.equal(await f.locator('#nd_prompt_system_group input[type="text"], #nd_prompt_system_group input:not([type])').last().inputValue(),'新增标题');
  assert.equal(await f.locator('#nd_prompt_system_group textarea').last().inputValue(),'新增正文');
  const ordered=await actual.evaluate(()=>Boolean(document.querySelector('#view-prompts .preset-bar').compareDocumentPosition(document.querySelector('#view-prompts fieldset')) & Node.DOCUMENT_POSITION_FOLLOWING));assert.equal(ordered,true);
  await f.locator('#nd_prompt_system_group summary').last().click();
  await f.locator('#nd_prompt_system_group summary').last().click();
  await f.locator('#nd_prompt_system_group button').last().click();assert.equal(await f.locator('#nd_prompt_system_group textarea').count(),1);
  await actual.evaluate(()=>{document.getElementById('nd_model_sel').value='custom';document.getElementById('nd_model').value='nai-diffusion-4-5-full';applyModelGuideForCurrentModel();});
  await f.locator('[data-add-prompt="modelGuide"]').click();
  await f.locator('#nd_prompt_guide_group summary').last().click();
  await f.locator('#nd_prompt_guide_group input[type="text"], #nd_prompt_guide_group input:not([type])').last().fill('V45标题');
  await f.locator('#nd_prompt_guide_group textarea').last().fill('V45内容');
  await actual.evaluate(()=>{document.getElementById('nd_model_sel').value='custom';document.getElementById('nd_model').value='nai-diffusion-5-full';applyModelGuideForCurrentModel();});
  assert.equal(await f.locator('#nd_prompt_guide_group textarea').first().inputValue(),'V5指南');
  await actual.evaluate(()=>{document.getElementById('nd_model').value='nai-diffusion-4-5-full';applyModelGuideForCurrentModel();});
  assert.equal(await f.locator('#nd_prompt_guide_group input[type="text"], #nd_prompt_guide_group input:not([type])').last().inputValue(),'V45标题');
  await f.locator('#nd_prompt_reset_guide').click();assert.equal(await f.locator('#nd_prompt_guide_group textarea').count(),1);
  assert.equal(await f.locator('#nd_prompt_guide_group textarea').inputValue(),'默认指南');
  await actual.evaluate(saved=>{state.promptPresets[0]={...state.promptPresets[0],...saved};promptGroupDrafts.clear();promptTextDraftsByPreset.clear();applyPromptPreset();},saved);
  assert.equal(await f.locator('#nd_prompt_system_group input[type="text"], #nd_prompt_system_group input:not([type])').last().inputValue(),'新增标题');
  assert.equal(await f.locator('#nd_prompt_system_group textarea').last().inputValue(),'新增正文');
  assert.equal(await f.locator('#nd_collapse_images').isChecked(),true);
  const card=f.locator('#nd_prompt_system_group details').last();
  const before=await card.evaluate(el=>el.open);
  await card.locator('input[type=checkbox]').uncheck();
  assert.equal(await card.evaluate(el=>el.open),before);
  await actual.evaluate(()=>{handleSaveResult(true);document.getElementById('nd_prompt_preset_save').click();});
  await h.page.waitForFunction(()=>window.lastSettingsMessage?.promptDraft?.promptGroups?.topSystem?.[1]?.enabled===false);
  const disabled=await h.page.evaluate(()=>window.lastSettingsMessage.promptDraft);
  assert.equal(disabled.promptGroups.topSystem[1].enabled,false);assert.equal(disabled.topSystem,'原文');
  await actual.evaluate(()=>applyPromptPreset());
  assert.equal(await card.evaluate(el=>el.open),before);

 } finally {await h.close();}
});

test('image folding survives rerender, saved fallback and IndexedDB reload',async()=>{
 const h=await harness();
 try {
  const result=await h.page.evaluate(async prefix=>{
   window.ctx={chatId:'fold-chat',chat:[{mes:'正文[image:fold-slot]',swipe_id:0}]};
   const gallery=await import(prefix+'modules/draw/shared/gallery-cache.js');
   const common=await import(prefix+'modules/draw/shared/draw-common.js');
   await gallery.storePreview({imgId:'fold-img',slotId:'fold-slot',messageId:0,savedUrl:'/saved.png',collapseImages:true});
   await common.syncDrawSavedFromPreview(0,await gallery.getPreview('fold-img'));
   document.body.innerHTML='<div id="chat"><div class="mes" mesid="0"><div class="mes_text">正文[image:fold-slot]</div></div></div>';
   await common.renderPreviewsForMessage(0);const fold=document.querySelector('.xb-image-fold');const initial=fold.open;fold.open=true;
   await common.renderPreviewsForMessage(0,{refreshSlotIds:['fold-slot']});const after=document.querySelector('.xb-image-fold').open;
   return {initial,after,saved:common.getDrawSavedEntry(window.ctx.chat[0],'fold-slot').collapseImages};
  },prefix);
  assert.deepEqual(result,{initial:false,after:true,saved:true});
  await h.page.reload();
  assert.equal(await h.page.evaluate(async prefix=>(await(await import(prefix+'modules/draw/shared/gallery-cache.js')).getPreview('fold-img')).collapseImages,prefix),true);
 } finally {await h.close();}
});


test('focus dialog supports multiline text, image previews, removal, submit and cancel', async () => {
 const h = await harness();
 try {
  await h.page.evaluate(async prefix => {
   const {openDrawFocusDialog} = await import(prefix+'modules/draw/shared/draw-focus-dialog.js');
   window.openFocus = () => { window.focusResult = undefined; window.focusPromise = openDrawFocusDialog({messageId:7}).then(value => {window.focusResult=value;}); };
   window.openFocus();
  }, prefix);
  await h.page.getByRole('textbox').fill('第一行\n第二行');
  await h.page.locator('.nd-focus-dialog input[type=file]').setInputFiles({name:'reference.png',mimeType:'image/png',buffer:Buffer.from(base64.split(',')[1],'base64')});
  await h.page.waitForSelector('.nd-focus-image img');
  assert.equal(await h.page.locator('.nd-focus-image img').count(),1);
  await h.page.getByRole('button',{name:'移除 reference.png',exact:true}).click();
  assert.equal(await h.page.locator('.nd-focus-image img').count(),0);
  await h.page.locator('.nd-focus-dialog input[type=file]').setInputFiles({name:'reference.png',mimeType:'image/png',buffer:Buffer.from(base64.split(',')[1],'base64')});
  await h.page.waitForSelector('.nd-focus-image img');
  await h.page.getByRole('button',{name:'提交',exact:true}).click();
  const result=await h.page.evaluate(()=>window.focusPromise.then(()=>window.focusResult));
  assert.equal(result.focusRequirement,'第一行\n第二行');
  assert.equal(result.focusImages[0].url,base64);
  await h.page.setViewportSize({width:390,height:700});
  await h.page.evaluate(()=>window.openFocus());
  const bounds=await h.page.locator('.nd-focus-dialog').boundingBox();
  assert.ok(bounds.width<=390 && bounds.height<=700);
  await h.page.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await h.page.evaluate(()=>window.focusPromise.then(()=>window.focusResult)),null);
  assert.deepEqual(h.errors,[]);
 } finally {await h.close();}
});
