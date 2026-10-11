import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImageBlock, serializeSectionImageProtocol } from '../../modules/draw/shared/comic-protocol.js';
import { createComicTasks, buildComicMessages, resolveComicPromptMacros } from '../../modules/draw/shared/comic-planning.js';
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
test('comic messages use configured rules only and preserve mode protocol; mode persists in imported preset',()=>{
 for (const mode of ['inline','end']) {
  const messages=buildComicMessages({source:'正文',mode,maxImages:2,opening:'用户全彩',guide:'用户模型指南',rules:'用户分镜'});
  assert.equal(messages.length,3);assert.equal(messages[0].content,'用户全彩');
  assert.match(messages[1].content,/用户模型指南/);assert.match(messages[1].content,/用户分镜/);
  assert.match(messages[1].content,/@page/);assert.match(messages[1].content,/最多输出 2/);
  assert.doesNotMatch(messages.map(m=>m.content).join('\n'),/黑白脱色|少年热血|天地出血|COMIC-DIRECTOR/);
 }
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


test('draw logs redact credentials, bound memory and return detached records', async () => {
 const {appendDrawLog,getDrawLogs,clearDrawLogs}=await import('../../modules/draw/shared/scene-planner-debug.js');
 clearDrawLogs();
 appendDrawLog('request',{apiKey:'private',nested:{Authorization:'Bearer private'},error:'Bearer exposed',url:'https://test.invalid?token=private',response:'sk-secret'});
 const record=getDrawLogs()[0];
 assert.doesNotMatch(record.details,/private|exposed|sk-secret/);
 record.stage='changed';assert.equal(getDrawLogs()[0].stage,'request');
 for(let i=0;i<101;i++)appendDrawLog('progress',{i});
 assert.equal(getDrawLogs().length,100);
 appendDrawLog('long',{response:'x'.repeat(40000)});assert.match(getDrawLogs().at(-1).details,/已截断/);
 const circular={};circular.self=circular;assert.doesNotThrow(()=>appendDrawLog('invalid',circular));
 clearDrawLogs();assert.deepEqual(getDrawLogs(),[]);
});

test('comic LLM logs capture real adapter request, response and terminal failure', async () => {
 const {callComicText}=await import('../../modules/draw/shared/comic-agent.js');
 const agentCore=await import('../../modules/agent-core/dist/agent-core-browser.js');
 const {getDrawLogs,clearDrawLogs}=await import('../../modules/draw/shared/scene-planner-debug.js');
 const previousFetch=globalThis.fetch;let count=0;
 const context={agentCore,providerConfig:{provider:'openai-compatible',baseUrl:'https://test.invalid/v1',model:'test',apiKey:'dummy',timeoutMs:1000}};
 try {
  clearDrawLogs();
  globalThis.fetch=async()=>{count++;return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:'完整描述'},finish_reason:'stop'}]}),{status:200,headers:{'content-type':'application/json'}});};
  assert.equal(await callComicText([{role:'user',content:'正文'}],{context}),'完整描述');
  assert.equal(count,1);assert.match(getDrawLogs().find(r=>r.stage.includes('开始请求')).details,/正文/);
  assert.match(getDrawLogs().at(-1).details,/完整描述/);
  globalThis.fetch=async()=>new Response(JSON.stringify({error:{message:'test failure'}}),{status:400,headers:{'content-type':'application/json'}});
  await assert.rejects(callComicText([{role:'user',content:'正文'}],{context}),/test failure/);
  assert.equal(getDrawLogs().at(-1).level,'error');assert.match(getDrawLogs().at(-1).details,/test failure/);
 } finally {globalThis.fetch=previousFetch;clearDrawLogs();}
});


test('prompt groups retain legacy text, titles, order, explicit empty groups and v4 import', async () => {
 const {normalizePromptGroups,applyPromptGroups}=await import('../../modules/draw/shared/prompt-groups.js');
 const legacy={topSystem:'旧开场\n保持原文',sceneRules:'旧规则',modelGuideOverrides:{'v4.5':'旧指南'}};
 assert.equal(applyPromptGroups({...legacy,promptGroups:normalizePromptGroups(null,legacy)}).topSystem,legacy.topSystem);
 const groups={topSystem:[{title:'视角',content:'第一条'},{title:'人物',content:'第二条'}],sceneRules:[],modelGuides:{'v4.5':[{title:'指南',content:'模型文字'}]}};
 const imported=parseNovelPromptPresetImport({_type:'novel-draw-prompt-template',_version:4,...legacy,promptGroups:groups,collapseImages:true});
 assert.equal(imported.topSystem,'### 视角\n第一条\n\n### 人物\n第二条');
 assert.equal(imported.sceneRules,'');assert.equal(imported.collapseImages,true);
 assert.equal(imported.modelGuideOverrides['v4.5'],'### 指南\n模型文字');
 assert.equal(imported.promptGroups.topSystem.length,2);
 assert.throws(()=>normalizePromptGroups({topSystem:[{title:'bad'}]},legacy),/标题和正文/);
});

 test('disabled prompt rows remain stored but are excluded from generation', async () => {
 const {normalizePromptRows,joinPromptRows}=await import('../../modules/draw/shared/prompt-groups.js');
 const rows=[{title:'启用',content:'使用'}, {title:'禁用',content:'忽略',enabled:false}];
 assert.equal(normalizePromptRows(rows)[0].enabled,true);
 assert.equal(normalizePromptRows(rows)[1].enabled,false);
 assert.equal(joinPromptRows(rows),'### 启用\n使用');
 });

test('draw logs preserve nested error details and redact their credentials', async () => {
 const {appendDrawLog,getDrawLogs,clearDrawLogs}=await import('../../modules/draw/shared/scene-planner-debug.js');
 clearDrawLogs();const error=new Error('HTTP 500');error.cause={apiKey:'private',message:'upstream failed'};
 appendDrawLog('失败',{error},'error');const entry=getDrawLogs()[0];
 assert.match(entry.details,/HTTP 500/);assert.match(entry.details,/upstream failed/);assert.doesNotMatch(entry.details,/private/);
 clearDrawLogs();
});

test('agent provider config preserves provider body params and timeout defaults', async () => {
 const {normalizeAgentConfig}=await import('../../modules/agent-core/config.js');
 const {resolveActiveProviderConfig}=await import('../../modules/agent-core/provider-resolution.js');
 const config=normalizeAgentConfig({presets:{x:{provider:'openai-compatible',modelConfigs:{'openai-compatible':{requestBodyParams:'{"thinking":{"type":"disabled"}}',timeoutMs:12345}}}},currentPresetName:'x'});
 const provider=config.presets.x.modelConfigs['openai-compatible'];
 assert.equal(provider.requestBodyParams,'{"thinking":{"type":"disabled"}}');assert.equal(provider.timeoutMs,12345);
 assert.equal(config.presets.x.modelConfigs.anthropic.requestBodyParams,'');assert.equal(config.presets.x.modelConfigs.anthropic.timeoutMs,600000);
 const active=resolveActiveProviderConfig(config);
 assert.equal(active.requestBodyParams,'{"thinking":{"type":"disabled"}}');
 assert.equal(active.timeoutMs,12345);
});

test('comic prompt macros resolve through the host substituteParams function in group order', () => {
    const calls = [];
    const vars = new Map();
    const substitute = (text) => {
        calls.push(text);
        return String(text)
            .replace(/\{\{setvar::([^:]+)::([^}]*)}}/g, (_, key, value) => {
                vars.set(key, value);
                return '';
            })
            .replace(/\{\{getvar::([^}]+)}}/g, (_, key) => vars.get(key) || '');
    };

    const result = resolveComicPromptMacros({
        opening: '{{setvar::tone::全彩}}\n{{getvar::tone}}',
        guide: '指南 {{getvar::tone}}',
        rules: '规则',
    }, substitute);

    assert.deepEqual(result, {
        opening: '\n全彩',
        guide: '指南 全彩',
        rules: '规则',
    });
    assert.equal(calls.length, 3);
});
