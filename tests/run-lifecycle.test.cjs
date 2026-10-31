/** 会话生命周期回归：用可控延迟驱动实际页面脚本和共享逻辑，不调用模型或真实数据库。 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');
const vue = require('../node_modules/vue');

/** 编译实际源文件，并注入可控网络与路由；Vue 模板不参与状态竞态测试。 */
function load(file, mocks, expose = '', timers = { setTimeout: fn => setTimeout(fn, 0), clearTimeout }, clock = Date) {
  let source = fs.readFileSync(path.join(__dirname, '../src/research', file), 'utf8');
  if (file.endsWith('.vue')) source = source.split('<script setup lang="ts">')[1].split('</script>')[0];
  source = source.replaceAll('import.meta.env', '({})') + '\n' + expose;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: id => mocks[id] ?? (
    id === '@/research/composables/useResearchSource' ? load('composables/useResearchSource.ts', mocks)
      : id === '@/research/api/research-source' ? load('api/research-source.ts', mocks) : {}
  ), AbortController, DOMException, TextDecoder, Error, Date: clock,
    defineProps: () => ({}), defineEmits: () => () => {},
    window: timers, console });
  return exports;
}
/** 建立可手动完成的请求，以确定性重现晚到响应。 */
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
/** 手动推进静默计时，覆盖推送挂起而不依赖真实五秒等待。 */
function progressClock() {
  let now = 0; let nextId = 0;
  const pending = new Map();
  /** 仅替换被测模块的时间来源，不修改测试进程全局 Date。 */
  class Clock extends Date {
    /** 返回手动推进的毫秒值。 */
    static now() { return now; }
  }
  return {
    Clock,
    pending,
    timers: {
      /** 登记虚拟计时器，并返回可取消的唯一编号。 */
      setTimeout(fn, delay) { const id = ++nextId; pending.set(id, { fn, at: now + delay }); return id; },
      /** 页面离开或任务终态时移除对应计时器。 */
      clearTimeout(id) { pending.delete(id); },
    },
    /** 推进五秒并排空该轮异步快照回调。 */
    async tick() {
      now += 5000;
      for (const [id, timer] of [...pending]) {
        if (timer.at <= now) { pending.delete(id); timer.fn(); }
      }
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}
/** 最小会话快照，消息始终带对应 Run ID。 */
function conversation(id, answer = false) { return { knowledge_base_id: '9', messages: [{ role: 'USER', agent_run_id: id, content: id }, ...(answer ? [{ role: 'ASSISTANT', agent_run_id: id, content: 'answer-'+id }] : [])] }; }
/** 装载启明真实脚本，跳过自动挂载和 UI 副作用。 */
function qiming(api, conversations, router = { push: async()=>{}, replace: async()=>{} }) {
  const app = load('views/qiming/QimingView.vue', {
    vue: { ...vue, watch() {}, onMounted() {}, onBeforeUnmount() {} },
    'vue-router': { useRoute: () => ({ path: '/database-research', meta: {}, params: {}, query: {} }), useRouter: () => router },
    '@/research/api/agents': api, '@/research/api/conversations': conversations,
    '@/research/composables/useResizableResearchPanels': { useResizableResearchPanels: () => ({}) },
    '@/research/stores/research-workspace': { useResearchWorkspaceStore: () => ({}) },
    '@/research/utils/client-id': { createClientUuid: () => 'request-test' },
    'element-plus': { ElMessage: { error() {}, warning() {} } },
    axios: { default: { isAxiosError: () => false } },
  }, 'export { knowledgeBases, conversations, openConversation, newConversation, submitQuestion, loadRun, messages, evidence, evidencePending, evidencePendingMessage, currentRun, running, selectedConversationId, selectedKnowledgeBaseId, query, loadingWorkspace, canSubmit, activeCitation, citationViewerOpen, liveNode, liveStatusLabel };');
  app.knowledgeBases.value = [{id:'9',name:'测试知识库'}];
  return app;
}

test('启明：恢复运行中会话即使已有证据也保持隐藏，终态与回答就绪后才展示', async () => {
  let finished=false; const completion=deferred();
  const app=qiming({fetchAgentRun:async()=>({id:'A',status:finished?'SUCCESS':'RUNNING',final_answer:finished?'answer-A':null}),
    fetchAgentEvidence:async()=>['retrieved-before-answer'],streamAgentRun:()=>completion.promise},
    {fetchConversation:async()=>conversation('A',finished),fetchConversations:async()=>({items:[],total:0})});
  app.loadingWorkspace.value=false;
  await app.openConversation('A',false);
  assert.equal(app.evidence.value.length,1);
  assert.equal(app.evidencePending.value,true);
  assert.match(app.evidencePendingMessage.value,/正在生成并校验/);
  finished=true;completion.resolve();await new Promise(r=>setImmediate(r));
  assert.equal(app.messages.value[1].content,'answer-A');
  assert.equal(app.evidencePending.value,false);
});

test('启明：恢复后断流不能把已检索证据当作完整回答发布', async () => {
  const app=qiming({fetchAgentRun:async()=>({id:'A',status:'RUNNING',final_answer:null}),
    fetchAgentEvidence:async()=>['early'],streamAgentRun:async()=>{throw Error('offline');}},
    {fetchConversation:async()=>conversation('A')});
  app.loadingWorkspace.value=false;
  await app.openConversation('A',false);await new Promise(r=>setImmediate(r));
  assert.equal(app.running.value,false);
  assert.equal(app.evidence.value.length,1);
  assert.equal(app.evidencePending.value,true);
});

test('启明：成功状态但空白或部分回答不能放出证据，完整同 Run 回答才展示', async () => {
  const app=qiming({},{});app.loadingWorkspace.value=false;
  app.currentRun.value={id:'A',status:'SUCCESS',final_answer:'完整回答'};
  app.evidence.value=['early'];app.messages.value=[{role:'ASSISTANT',agent_run_id:'A',content:''}];
  assert.equal(app.evidencePending.value,true);
  app.messages.value[0].content='完整';assert.equal(app.evidencePending.value,true);
  app.messages.value[0].content='完整回答';assert.equal(app.evidencePending.value,false);
  app.messages.value[0].agent_run_id='B';assert.equal(app.evidencePending.value,true);
});

test('共库结果适配：三个专业模块均投影正文，证据必须等成功正文就绪', async () => {
  for (const [executor,type,field] of [['ZHIJIAN','ZHIJIAN_COMPARISON','zhijian_result'],
    ['SUZHI','SUZHI_LITERATURE_REVIEW','suzhi_result'],['RONGTONG','RONGTONG_POLICY_COMMUNICATION','rongtong_result']]) {
    const payload={status:'SUCCESS',summary:'专业正文'};
    const api=load('api/agents.ts',{'@/research/api/http':{http:{get:async()=>({data:{data:{
      id:'A',executor_agent:executor,status:'SUCCESS',result_payload:{result_type:type,payload},
    }}})}}});
    const projected=await api.fetchAgentRun('A');assert.equal(projected[field],payload);
    const {useProfessionalRun}=load('composables/useProfessionalRun.ts', {
      vue:{...vue,watch(){},onBeforeUnmount(){}},
      'vue-router':{useRoute:()=>({path:'/database-research',meta:{},params:{}}),useRouter:()=>({})},
    });
    const app=useProfessionalRun({executor,history:vue.ref([]),onLoaded(){},onError(){},refreshHistory:async()=>{}});
    app.selectedRunId.value='A';app.run.value={...projected,status:'RUNNING'};
    assert.equal(app.evidencePending.value,true); // 断流清掉 running 后仍须等待真实终态。
    app.run.value={...projected,[field]:null};assert.equal(app.evidencePending.value,true);
    app.run.value=projected;assert.equal(app.evidencePending.value,false);
  }
});

test('启明：切换消息时立即撤下旧证据，失败也不保留旧引用', async () => {
  const wait = deferred();
  const app = qiming({ fetchAgentRun: () => wait.promise, fetchAgentEvidence: async()=>[] }, {});
  app.evidence.value = ['previous'];
  app.activeCitation.value = { old: true }; app.citationViewerOpen.value = true;
  const loading = app.loadRun('next');
  assert.equal(app.evidence.value.length, 0);
  assert.equal(app.activeCitation.value, null);
  assert.equal(app.citationViewerOpen.value, false);
  wait.resolve({id:'next',status:'SUCCESS'}); await loading;
});

test('启明：会话加载中禁止提交，防止读取结果覆盖新问题', async () => {
  const wait = deferred(); let submissions = 0;
  const app = qiming({createQimingRun: async()=>{submissions++;}}, {fetchConversation:()=>wait.promise});
  app.loadingWorkspace.value = false; app.selectedKnowledgeBaseId.value = '9'; app.query.value = '新问题';
  const opening = app.openConversation('A', false);
  assert.equal(app.canSubmit.value, false);
  await app.submitQuestion(); assert.equal(submissions, 0);
  wait.resolve({knowledge_base_id:'9',messages:[]}); await opening;
});

test('启明：创建后的路由晚返回不能重启旧流或覆盖另一会话', async () => {
  const navigation = deferred(); const streams = [];
  const app = qiming({
    createQimingRun: async()=>({run_id:'A',conversation_id:'A',knowledge_base_id:'9',status:'PENDING'}),
    fetchAgentRun: async id=>({id,status:'SUCCESS'}), fetchAgentEvidence: async id=>[id],
    streamAgentRun: async id=>{streams.push(id);},
  }, {fetchConversation:async id=>conversation(id,true),fetchConversations:async()=>({items:[],total:0})},
  {replace:()=>navigation.promise,push:async()=>{}});
  app.loadingWorkspace.value=false;app.selectedKnowledgeBaseId.value='9';app.query.value='新问题';
  const submitting=app.submitQuestion(); await new Promise(r=>setImmediate(r));
  await app.openConversation('B',false); navigation.resolve(); await submitting;
  assert.deepEqual(streams,[]);assert.equal(app.selectedConversationId.value,'B');assert.equal(app.evidence.value[0],'B');
});

test('共用 SSE：收到完成事件即返回，即使 HTTP 连接仍未关闭', async () => {
  let reads=0;let cancelled=false;
  const api=load('api/agents.ts', {'@/research/api/http':{authorizedFetch:async()=>({ok:true,body:{getReader:()=>({
    read:async()=>{if(++reads>1)throw Error('不应等待终态后的 EOF');return {done:false,value:new TextEncoder().encode('event: complete\ndata: {"status":"SUCCESS"}\n\n')};},
    cancel:async()=>{cancelled=true;},
  })}})}});
  await api.streamAgentRun('A',()=>{},new AbortController().signal);
  assert.equal(reads,1);assert.equal(cancelled,true);
});

test('共用进度：代理连响应头都缓冲时仍更新检索、生成并读取终态', async () => {
  const clock = progressClock(); const events = []; const requests = []; let streamSignal;
  const snapshots = [
    { status: 'RUNNING', steps: [{ sequence: 1, node_name: 'RetrieveEvidence', status: 'RUNNING' }] },
    { status: 'RUNNING', steps: [{ sequence: 1, node_name: 'RetrieveEvidence', status: 'SUCCESS' },
      { sequence: 2, node_name: 'GenerateAnswer', status: 'RUNNING' }] },
    { status: 'SUCCESS', steps: [{ sequence: 1, node_name: 'RetrieveEvidence', status: 'SUCCESS' },
      { sequence: 2, node_name: 'GenerateAnswer', status: 'SUCCESS' }] },
  ];
  const api = load('api/agents.ts', { '@/research/api/http': {
    authorizedFetch: (url, { signal }) => new Promise((resolve, reject) => {
      streamSignal = signal;
      signal.addEventListener('abort', () => reject(new DOMException('cancel', 'AbortError')));
    }),
    http: { get: async (url, config) => {
      requests.push(url); assert.equal(config.signal, streamSignal);
      return { data: { data: snapshots.shift() } };
    } },
  } }, '', clock.timers, clock.Clock);
  const finished = api.streamAgentRun('A', event => events.push(event), new AbortController().signal);
  await clock.tick();
  assert.equal(events.at(-1).data.node, 'RetrieveEvidence');
  await clock.tick();
  assert.equal(events.at(-1).data.node, 'GenerateAnswer');
  await clock.tick(); await finished;
  assert.deepEqual(requests, ['/agent-runs/A', '/agent-runs/A', '/agent-runs/A']);
  assert.equal(events.filter(event => event.event === 'run.completed').length, 1);
  assert.equal(streamSignal.aborted, true);
  assert.equal(clock.pending.size, 0);
});

test('共用进度：流块挂起时查询失败不打断任务，恢复后可确认完成', async () => {
  const clock = progressClock(); const events = []; const read = deferred(); let streamSignal; let polls = 0;
  const api = load('api/agents.ts', { '@/research/api/http': {
    authorizedFetch: async (url, { signal }) => {
      streamSignal = signal;
      signal.addEventListener('abort', () => read.resolve({ done: true }));
      return { ok: true, body: { getReader: () => ({ read: () => read.promise, cancel: async () => {} }) } };
    },
    http: { get: async () => {
      if (++polls === 1) throw Error('temporary network error');
      return { data: { data: { status: 'SUCCESS', steps: [] } } };
    } },
  } }, '', clock.timers, clock.Clock);
  const finished = api.streamAgentRun('A', event => events.push(event), new AbortController().signal);
  await clock.tick(); assert.equal(events.length, 0); assert.equal(streamSignal.aborted, false);
  await clock.tick(); await finished;
  assert.equal(events.at(-1).event, 'run.completed');
  assert.equal(streamSignal.aborted, true); assert.equal(clock.pending.size, 0);
});

test('共用进度：迟到的推送不重复发布快照事件或回退已完成步骤', async () => {
  const clock = progressClock(); const events = []; const read = deferred();
  const api = load('api/agents.ts', { '@/research/api/http': {
    authorizedFetch: async () => ({ ok: true, body: { getReader: () => ({
      read: () => read.promise, cancel: async () => {},
    }) } }),
    http: { get: async () => ({ data: { data: { status: 'RUNNING', steps: [
      { sequence: 1, node_name: 'RetrieveEvidence', status: 'SUCCESS' },
      { sequence: 2, node_name: 'GenerateAnswer', status: 'RUNNING' },
    ] } } }) },
  } }, '', clock.timers, clock.Clock);
  const finished = api.streamAgentRun('A', event => events.push(event), new AbortController().signal);
  await clock.tick();
  read.resolve({ done: false, value: new TextEncoder().encode(
    'id: A:step:1:RUNNING\nevent: step\ndata: {"name":"RetrieveEvidence","sequence":1,"status":"RUNNING"}\n\n'
    + 'id: A:step:2:RUNNING\nevent: step\ndata: {"name":"GenerateAnswer","sequence":2,"status":"RUNNING"}\n\n'
    + 'id: A:terminal\nevent: complete\ndata: {"status":"SUCCESS"}\n\n',
  ) });
  await finished;
  assert.equal(events.filter(event => event.id === 'A:step:1:RUNNING').length, 0);
  assert.equal(events.filter(event => event.id === 'A:step:2:RUNNING').length, 1);
  assert.equal(events.filter(event => event.event === 'run.completed').length, 1);
  assert.equal(clock.pending.size, 0);
});

test('共用进度：离开页面同时停止静默查询和推送，不创建额外运行', async () => {
  const clock = progressClock(); const owner = new AbortController(); let polls = 0; let streamSignal;
  const api = load('api/agents.ts', { '@/research/api/http': {
    authorizedFetch: (url, { signal }) => new Promise((resolve, reject) => {
      streamSignal = signal;
      signal.addEventListener('abort', () => reject(new DOMException('cancel', 'AbortError')));
    }),
    http: { get: async () => { polls++; return { data: { data: {} } }; } },
  } }, '', clock.timers, clock.Clock);
  const finished = api.streamAgentRun('A', () => {}, owner.signal);
  owner.abort();
  await assert.rejects(finished, error => error.name === 'AbortError');
  await clock.tick();
  assert.equal(polls, 0); assert.equal(streamSignal.aborted, true); assert.equal(clock.pending.size, 0);
});

test('启明：消息读取后任务完成，补读已发布回答', async () => {
  let reads = 0;
  const app = qiming({ fetchAgentRun: async id => ({ id, status: 'SUCCESS' }), fetchAgentEvidence: async()=>[] },
    { fetchConversation: async id => conversation(id, ++reads > 1) });
  await app.openConversation('A', false);
  assert.equal(reads, 2);
  assert.equal(app.messages.value[1].content, 'answer-A');
  assert.equal(app.running.value, false);
});

test('启明：新建问题在终态自动显示答案和本次证据，无需切换会话', async () => {
  const finish = deferred();
  const app = qiming({createQimingRun:async()=>({run_id:'fresh',conversation_id:'fresh',knowledge_base_id:'9',status:'PENDING'}),
    streamAgentRun:()=>finish.promise,fetchAgentRun:async()=>({id:'fresh',status:'SUCCESS'}),fetchAgentEvidence:async()=>['fresh-evidence']},
    {fetchConversation:async()=>conversation('fresh',true),fetchConversations:async()=>({items:[],total:0})});
  app.loadingWorkspace.value=false;app.selectedKnowledgeBaseId.value='9';app.query.value='新问题';app.evidence.value=['old'];
  const submitted=app.submitQuestion();await new Promise(r=>setImmediate(r));
  assert.equal(app.evidence.value.length,0);assert.equal(app.running.value,true);
  finish.resolve();await submitted;
  assert.equal(app.messages.value[1].content,'answer-fresh');assert.equal(app.evidence.value[0],'fresh-evidence');assert.equal(app.running.value,false);
});

test('启明：快速 A→B 切换清空旧证据，晚到 A 请求不能覆盖 B', async () => {
  const slow = deferred();
  const app = qiming({ fetchAgentRun: async id => ({ id, status: 'SUCCESS' }), fetchAgentEvidence: async id => [id] },
    { fetchConversation: id => id === 'A' ? slow.promise : Promise.resolve(conversation(id, true)) });
  app.evidence.value = ['old'];
  const first = app.openConversation('A', false);
  assert.equal(app.evidence.value.length, 0);
  await app.openConversation('B', false);
  slow.resolve(conversation('A', true)); await first;
  assert.equal(app.currentRun.value.id, 'B');
  assert.equal(app.evidence.value[0], 'B');
});

test('启明：运行中离开再返回，恢复订阅并显示最终回答', async () => {
  let finished = false; const streams = [];
  const app = qiming({ fetchAgentRun: async id => ({ id, status: id === 'A' && !finished ? 'RUNNING' : 'SUCCESS' }), fetchAgentEvidence: async id => [id],
    streamAgentRun: (id, callback, signal) => { const d=deferred(); streams.push(d); signal.addEventListener('abort',()=>d.resolve()); return d.promise; } },
    { fetchConversation: async id => conversation(id, id === 'B' || finished), fetchConversations: async()=>({items:[],total:0}) });
  await app.openConversation('A', false); assert.equal(app.running.value, true);
  await app.openConversation('B', false);
  await app.openConversation('A', false); assert.equal(streams.length, 2);
  finished = true; streams[1].resolve();
  await new Promise(r=>setImmediate(r));
  assert.equal(app.messages.value[1].content, 'answer-A');
  assert.equal(app.running.value, false);
  assert.equal(app.evidence.value[0], 'A');
});

test('运行详情适配保留步骤，恢复会话无需等待进度推送重放', async () => {
  const api = load('api/agents.ts', { '@/research/api/http': { http: { get: async () => ({ data: { data: {
    id: 'A', status: 'RUNNING', knowledge_base_id: 9,
    steps: [{ sequence: 7, node_name: 'RetrieveEvidence', status: 'RUNNING' }],
  } } }) } } });
  const run = await api.fetchAgentRun('A');
  assert.equal(run.steps[0].node_name, 'RetrieveEvidence');
  assert.equal(run.steps[0].sequence, 7);
});

test('启明：A→B→A 后立即恢复真实步骤，迟到旧事件不能倒退阶段', async () => {
  const handlers = []; let reads = 0;
  const app = qiming({
    fetchAgentRun: async id => ({ id, status: id === 'A' ? 'RUNNING' : 'SUCCESS',
      steps: id === 'A' ? [
        { sequence: 9, node_name: ++reads === 1 ? 'GenerateAnswer' : 'ResultReviewer', status: 'RUNNING' },
        { sequence: 1, node_name: 'AuthenticateContext', status: 'SUCCESS' },
        { sequence: 7, node_name: 'RetrieveEvidence', status: 'SUCCESS' },
      ] : [] }),
    fetchAgentEvidence: async () => [],
    streamAgentRun: (id, callback, signal) => new Promise(resolve => {
      handlers.push(callback); signal.addEventListener('abort', resolve);
    }),
  }, { fetchConversation: async id => conversation(id, id === 'B'),
    fetchConversations: async () => ({ items: [], total: 0 }) });
  await app.openConversation('A', false);
  assert.equal(app.liveStatusLabel.value, '文昌 · 组织回答');
  await app.openConversation('B', false); await app.openConversation('A', false);
  assert.equal(app.liveStatusLabel.value, '文昌 · 复核回答');
  handlers[1]({ id: 'A:step:1:RUNNING', event: 'node.started',
    data: { node: 'AuthenticateContext', sequence: 1 } });
  assert.equal(app.liveStatusLabel.value, '文昌 · 复核回答');
  handlers[1]({ id: 'A:step:10:RUNNING', event: 'node.started',
    data: { node: 'CitationValidator', sequence: 10 } });
  assert.equal(app.liveStatusLabel.value, '文昌 · 验证真实引用');
  await app.newConversation();
});

test('启明：恢复专业委派的共享校验节点时保留真实模块，已完成历史不创建占位', async () => {
  const app = qiming({
    fetchAgentRun: async id => ({ id, status: id === 'active' ? 'RUNNING' : 'SUCCESS',
      executor_agent_code: 'SUZHI', steps: [
        { sequence: 1, node_name: 'AuthenticateContext', status: 'SUCCESS' },
        { sequence: 11, node_name: 'LiteratureRetrieval', status: 'SUCCESS' },
        { sequence: 20, node_name: 'ResearchReviewer', status: 'RUNNING' },
      ] }),
    fetchAgentEvidence: async () => [],
    streamAgentRun: (id, callback, signal) => new Promise(resolve => signal.addEventListener('abort', resolve)),
  }, { fetchConversation: async id => conversation(id, id !== 'active'),
    fetchConversations: async () => ({ items: [], total: 0 }) });
  await app.openConversation('active', false);
  assert.equal(app.liveStatusLabel.value, '溯知 · 复核研究结论');
  await app.openConversation('finished', false);
  assert.equal(app.running.value, false);
  assert.equal(app.messages.value.filter(message => message.role === 'ASSISTANT').length, 1);
  assert.equal(app.messages.value.at(-1).content, 'answer-finished');
});

test('三个专业模块：切换后旧快照不能污染证据，节点按新 sequence 更新', async () => {
  for (const executor of ['ZHIJIAN','SUZHI','RONGTONG']) {
    const slow=deferred(); let handler;
    const {useProfessionalRun}=load('composables/useProfessionalRun.ts', {
      vue: {...vue, watch(){},onBeforeUnmount(){}},
      'vue-router': {useRoute:()=>({path:'/database-research',meta:{},params:{}}),useRouter:()=>({push:async()=>{}})},
      '@/research/api/agents': {fetchAgentRun: id=>id==='A'?slow.promise:Promise.resolve({id,executor_agent_code:executor,status:'RUNNING'}),
        fetchAgentEvidence:async id=>[id],fetchAgentSteps:async()=>[],streamAgentRun:async(id,cb)=>{handler=cb;await new Promise(()=>{});} },
    });
    const app=useProfessionalRun({executor,history:vue.ref([]),onLoaded(){},onError(e){throw e;},refreshHistory:async()=>{}});
    const first=app.loadRun('A',false);await app.loadRun('B',false);
    slow.resolve({id:'A',executor_agent_code:executor,status:'SUCCESS'});await first;
    assert.equal(app.evidence.value[0],'B');
    handler({id:'B:step:2:SUCCESS',event:'node.completed',data:{sequence:2,node:'Test'}});
    assert.equal(app.steps.value[0].sequence,2);assert.equal(app.steps.value[0].status,'SUCCESS');app.reset();
  }
});

test('共用 SSE：保留节点序号并识别失败节点', async () => {
  const events=[];
  const stream='id: A:step:3:FAILED\nevent: step\ndata: {"sequence":3,"name":"Test","status":"FAILED"}\n\nid: A:terminal\nevent: complete\ndata: {"status":"FAILED"}\n\n';
  const api=load('api/agents.ts', {'@/research/api/http':{authorizedFetch:async()=>new Response(stream)}});
  await api.streamAgentRun('A', e=>events.push(e), new AbortController().signal);
  assert.equal(events[0].data.sequence,3);assert.equal(events[0].event,'node.failed');assert.equal(events[1].event,'run.failed');
});

test('共用 SSE：取消的分析步骤映射为失败节点', async () => {
  const events=[];
  const stream='event: step\ndata: {"sequence":2,"name":"AnalyzeDocument:123","status":"CANCELLED"}\n\nevent: complete\ndata: {"status":"FAILED"}\n\n';
  const api=load('api/agents.ts', {'@/research/api/http':{authorizedFetch:async()=>new Response(stream)}});
  await api.streamAgentRun('A', e=>events.push(e), new AbortController().signal);
  assert.equal(events[0].event,'node.failed');assert.equal(events[0].data.status,'CANCELLED');
});

test('共用 SSE：连接连续失败后读取终态，避免永久思考', async () => {
  let connections=0;const events=[];
  const api=load('api/agents.ts', {'@/research/api/http':{authorizedFetch:async()=>{connections++;throw Error('offline');},
    http:{get:async()=>({data:{data:{id:'A',status:'SUCCESS',knowledge_base_id:9}}})}}});
  await api.streamAgentRun('A', e=>events.push(e), new AbortController().signal);
  assert.equal(connections,3);assert.equal(events[0].event,'run.completed');
});


test('启明：知识库已删除仍能打开历史，但禁止继续提问', async () => {
  let submissions = 0;
  const app = qiming({fetchAgentRun:async id=>({id,status:'SUCCESS',final_answer:'answer-A'}),
    fetchAgentEvidence:async()=>[],createQimingRun:async()=>{submissions++;}},
    {fetchConversation:async id=>conversation(id,true)});
  app.knowledgeBases.value=[];
  app.conversations.value=[{id:'A',knowledge_base_accessible:false}];
  app.loadingWorkspace.value=false;
  await app.openConversation('A',false);
  assert.equal(app.selectedConversationId.value,'A');
  assert.equal(app.messages.value[1].content,'answer-A');
  app.query.value='继续提问';
  assert.equal(app.canSubmit.value,false);
  await app.submitQuestion();
  assert.equal(submissions,0);
});

test('三个专业模块：知识库已删除仍能打开历史结果', async () => {
  for (const executor of ['ZHIJIAN','SUZHI','RONGTONG']) {
    const errors=[];
    const {useProfessionalRun}=load('composables/useProfessionalRun.ts', {
      vue:{...vue,watch(){},onBeforeUnmount(){}},
      'vue-router':{useRoute:()=>({path:'/database-research',meta:{},params:{}}),useRouter:()=>({})},
      '@/research/api/agents':{
        fetchAgentRun:async()=>({id:'A',status:'SUCCESS',executor_agent_code:executor}),
        fetchAgentEvidence:async()=>[],fetchAgentSteps:async()=>[],
      },
    });
    const app=useProfessionalRun({executor,
      history:vue.ref([{id:'A',status:'SUCCESS',knowledge_base_accessible:false}]),
      onLoaded(){},onError:error=>errors.push(error),refreshHistory:async()=>{}});
    await app.loadRun('A',false);
    assert.equal(errors.length,0);
    assert.equal(app.run.value.id,'A');
  }
});


test('证据相关性：使用重排分，旧记录不回退到 RRF，零分保留', async () => {
  for (const score of [0.725, null, undefined, 0]) {
    const api=load('api/agents.ts', {
      '@/research/api/http':{http:{get:async()=>({data:{data:[{
        corpus_id:11,point_id:'point',content_snapshot:'证据',retrieval_score:0.023,
        relevance_score:score,evidence_rank:1,page_start:1,page_end:1,
      }]}})}},
      '@/research/api/foreign-resources':{fetchForeignCorpusDetail:async()=>null},
    });
    const items=await api.fetchAgentEvidence('A');
    assert.equal(items[0].evidence.relevance_score,score ?? null);
    assert.equal(items[0].evidence.retrieval_score,0.023);
  }
  for (const file of ['qiming/QimingEvidencePanel.vue','zhijian/ZhijianEvidencePanel.vue']) {
    const panel=load('components/'+file,{vue:{...vue},},'export { scoreLabel };');
    assert.equal(panel.scoreLabel(null),'暂无');
    assert.equal(panel.scoreLabel(0.725),'73%');
    assert.equal(panel.scoreLabel(0),'0%');
  }
});
