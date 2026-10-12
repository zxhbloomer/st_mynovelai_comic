import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as rawCore from '../../modules/agent-core/dist/agent-core-browser.js';
import { resolveActiveProviderConfig } from '../../modules/agent-core/provider-resolution.js';
import { createConfiguredAgentAdapter } from '../../modules/agent-core/adapters/configured-adapter.js';

const yaml = 'thinking:\n  type: disabled';
const messages = [{ role: 'user', content: 'test' }];
const config = (provider, params = yaml) => resolveActiveProviderConfig({currentPresetName:'ds',presets:{ds:{provider,modelConfigs:{[provider]:{baseUrl:'https://test.invalid/v1/chat/completions/',apiKey:'test-key',model:'deepseek-flash',requestBodyParams:params,timeoutMs:12345}}}}});

test('YAML and old JSON are parsed once with array shallow-merge and empty skip', () => {
 assert.deepEqual(config('openai-compatible').extraBody,{thinking:{type:'disabled'}});
 assert.deepEqual(config('openai-compatible','{"thinking":{"type":"disabled"}}').extraBody,{thinking:{type:'disabled'}});
 assert.deepEqual({...config('openai-compatible','- top_k: 20\n- top_k: 30').extraBody},{top_k:30});
 assert.equal(config('openai-compatible',' ').extraBody,undefined);
 assert.throws(()=>config('openai-compatible','thinking: ['),/附加主体参数/);
 assert.throws(()=>config('openai-compatible','42'),/附加主体参数/);
 assert.equal(config('openai-compatible').timeoutMs,12345);
});

test('hosted OpenAI uses custom channel, explicit auth and custom_include_body', () => {
 const adapter=createConfiguredAgentAdapter(rawCore,config('sillytavern-openai-compatible'));
 const payload=adapter.buildPayload({messages,tools:[],maxTokens:32000});
 assert.equal(payload.chat_completion_source,'custom');
 assert.equal(payload.custom_url,'https://test.invalid/v1');
 assert.equal(JSON.parse(payload.custom_include_headers).Authorization,'Bearer test-key');
 assert.deepEqual(JSON.parse(payload.custom_include_body),{thinking:{type:'disabled'}});
 assert.equal(payload.reverse_proxy,undefined);
 assert.equal(payload.proxy_password,undefined);
 assert.deepEqual(payload.messages,messages);
});

test('direct adapter and backend adapter retain additional fields in final payload', () => {
 const cfg=config('openai-compatible');
 const browser=createConfiguredAgentAdapter(rawCore,cfg);
 assert.equal(browser.buildRequestBody({messages,tools:[]}).thinking.type,'disabled');
 const require=createRequire(import.meta.url);
 const nodeCore=require('../../server-plugin/sillytavern-novelai/draw-runs/vendor/agent-core-node.cjs');
 const nodeFactory=require('../../server-plugin/sillytavern-novelai/draw-runs/configured-adapter.cjs');
 const backend=nodeFactory.createConfiguredAgentAdapter(nodeCore,cfg);
 assert.equal(backend.buildRequestBody({messages,tools:[]}).thinking.type,'disabled');
});

test('explicit body overrides use shallow merge after standard generation fields', () => {
 const adapter=createConfiguredAgentAdapter(rawCore,config('openai-compatible','temperature: 0.5\nmax_tokens: 60000'));
 const payload=adapter.buildRequestBody({messages,tools:[],temperature:1,maxTokens:32000});
 assert.equal(payload.temperature,0.5);assert.equal(payload.max_tokens,60000);
});


test('comic request actually sends custom fields and logs redact the serialized key', async () => {
 const {callComicText}=await import('../../modules/draw/shared/comic-agent.js');
 const {getDrawLogs,clearDrawLogs}=await import('../../modules/draw/shared/scene-planner-debug.js');
 const oldFetch=globalThis.fetch;
 let wire;
 rawCore.setHostChatCompletionsRequestHeadersProvider(()=>({'X-CSRF-Token':'test-csrf'}));
 try {
  clearDrawLogs();
  globalThis.fetch=async (_url, options)=>{
   wire=JSON.parse(options.body);
   return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:'描述'},finish_reason:'stop'}]}),{headers:{'content-type':'application/json'}});
  };
  assert.equal(await callComicText(messages,{context:{agentCore:rawCore,providerConfig:config('sillytavern-openai-compatible')}}),'描述');
  assert.equal(wire.chat_completion_source,'custom');
  assert.deepEqual(JSON.parse(wire.custom_include_body),{thinking:{type:'disabled'}});
  // Mirrors ST custom branch's final shallow merge of parsed custom_include_body.
  const finalBody={messages:wire.messages,model:wire.model,...JSON.parse(wire.custom_include_body)};
  assert.equal(finalBody.thinking.type,'disabled');
  const log=getDrawLogs().find(entry=>entry.stage.includes('请求参数'));
  assert.match(log.details,/custom_include_body/);
  assert.doesNotMatch(log.details,/test-key|test-csrf/);
 } finally {globalThis.fetch=oldFetch;clearDrawLogs();}
});

test('native providers merge arbitrary protocol fields after standard construction', () => {
 for (const [provider,field] of [['anthropic','top_k'],['openai-responses','store']]) {
  const adapter=createConfiguredAgentAdapter(rawCore,config(provider,field==='store'?'store: false':'top_k: 20'));
  const payload=adapter.buildRequestBody({messages,tools:[],maxTokens:1000});
  assert.equal(payload[field],field==='store'?false:20);
 }
 const google=createConfiguredAgentAdapter(rawCore,config('google','generationConfig:\n  topK: 20'));
 assert.equal(google.buildChatPayload({messages,tools:[]}).createPayload.config.httpOptions.extraBody.generationConfig.topK,20);
 assert.throws(()=>createConfiguredAgentAdapter(rawCore,config('sillytavern-claude')),/不支持任意附加/);
});

test('backend hosted adapter sends the same custom body through its injected host client', async () => {
 const require=createRequire(import.meta.url);
 const nodeCore=require('../../server-plugin/sillytavern-novelai/draw-runs/vendor/agent-core-node.cjs');
 const nodeFactory=require('../../server-plugin/sillytavern-novelai/draw-runs/configured-adapter.cjs');
 let wire;
 const hostClient=nodeCore.createHostChatCompletionsClient({
  requestHeadersProvider:()=>({'X-CSRF-Token':'test-csrf'}),
  fetch:async (_url,options)=>{
   wire=JSON.parse(options.body);
   return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:'描述'},finish_reason:'stop'}]}),{headers:{'content-type':'application/json'}});
  },
 });
 const adapter=nodeFactory.createConfiguredAgentAdapter(nodeCore,config('sillytavern-openai-compatible'),{hostClient});
 assert.equal((await adapter.chat({messages,tools:[]})).text,'描述');
 assert.equal(wire.chat_completion_source,'custom');
 assert.deepEqual(JSON.parse(wire.custom_include_body),{thinking:{type:'disabled'}});
});


test('background envelope accepts parsed body parameters without dropping them', () => {
 const require=createRequire(import.meta.url);
 const runtime=require('../../server-plugin/sillytavern-novelai/draw-runs/vendor/draw-run-runtime.cjs');
 const {createEnvelopeValidator}=require('../../server-plugin/sillytavern-novelai/draw-runs/envelope.js');
 const sourceText='原正文';const sourceHash=runtime.hashSceneSource(sourceText);
 const cfg=config('sillytavern-openai-compatible');delete cfg.tavilyApiKey;delete cfg.tavilyBaseUrl;
 const envelope={version:1,runId:'run-test',sourceHash,imageProvider:'sd-webui',
  planner:{prompt:{systemPrompt:'',messages},tool:{type:'function',function:{name:'submit_scene_plan',description:'test',parameters:{type:'object',required:['images'],properties:{images:{type:'array'}}}}},
   validationContext:{sceneSource:{sourceText,sourceHash,content:sourceText,numberedContent:sourceText,points:[{number:1,offset:3}]},effectiveMaxImages:1,maxPlanImages:1,effectiveMaxCharactersPerImage:0,centerMode:'grid'},presentCharacters:[]},
  agent:{channel:cfg.provider,providerConfig:cfg},
  generationRecipe:{host:'https://test.invalid',auth:'',timeout:1000,delayMs:1,params:{},positivePrefix:'',negativePrefix:'',knownCharacters:[],promptOverride:'',negativePromptOverride:''}};
 // The validator delegates run-id syntax to the runtime; isolate this test to envelope fields.
 const validate=createEnvelopeValidator({...runtime,assertDrawRunId:value=>value});
 const result=validate(envelope);
 assert.deepEqual(result.envelope.agent.providerConfig.extraBody,{thinking:{type:'disabled'}});
});

test('mode-one cancellation timer uses the configured timeout when no override is given', async () => {
 const {callDrawScenePlannerAgentRuntime}=await import('../../modules/draw/shared/draw-agent-runtime.js');
 const task={messages,tools:[{function:{name:'submit_scene_plan'}}]};
 const start=Date.now();
 await assert.rejects(callDrawScenePlannerAgentRuntime({task,providerConfig:{provider:'openai-compatible',timeoutMs:25},
  agentCore:{createAgentAdapter:()=>({chat:async ({signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))})}}),error=>error.code==='REQUEST_TIMEOUT');
 assert.ok(Date.now()-start<1000);
});

test('model list uses the same custom base URL and authorization as generation', async () => {
    const { createHostChatCompletionsClient } = await import('../../shared/host-llm/chat-completions/client.js');
    let sent;
    const client = createHostChatCompletionsClient({
        requestHeadersProvider: () => ({ 'X-CSRF-Token': 'test-csrf' }),
        fetch: async (url, options) => {
            sent = { url, ...options, body: JSON.parse(options.body) };
            return new Response(JSON.stringify({ data: [{ id: 'test-model' }] }));
        },
    });
    assert.deepEqual(await client.fetchHostOpenAICompatibleModels(config('sillytavern-openai-compatible')), ['test-model']);
    assert.equal(sent.body.chat_completion_source, 'custom');
    assert.equal(sent.body.custom_url, 'https://test.invalid/v1');
    assert.equal(JSON.parse(sent.body.custom_include_headers).Authorization, 'Bearer test-key');
    assert.equal(sent.headers['X-CSRF-Token'], 'test-csrf');
});
