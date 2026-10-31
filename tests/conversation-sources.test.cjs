/** 入口来源契约：同一个启明接口在写作与研究页面必须保存为不同来源。 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');

/** 在隔离上下文加载前端契约模块，HTTP 与前端开关均由明确依赖提供。 */
function load(file, http) {
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: id => ({
      axios: { default: { create: () => http } },
      '@/router': { default: {} },
      '@/research/api/http': { http },
      './features': load('research/features.ts', http),
      '@/research/api/foreign-resources': { fetchForeignKnowledgeBases: async () => ({ items: http.knowledgeBases || [], total: (http.knowledgeBases || []).length }) },
    })[id] ?? (id === '@/research/api/research-source' ? load('research/api/research-source.ts', http) : {}),
  });
  return exports;
}

function transport() {
  const calls = [];
  const response = { data: { code: 'OK', data: { items: [], messages: [], run_id: 'run' } } };
  return {
    calls,
    get: async (url, config) => { calls.push({ url, config }); return response; },
    post: async (url, payload) => { calls.push({ url, payload }); return response; },
    interceptors: { request: { use() {} }, response: { use() {} } },
  };
}

test('辅助创作调用 Quill 或启明均固定 WRITING，列表和缓存恢复使用相同来源', async () => {
  const http = transport();
  const api = load('api/quill.js', http);
  await api.createQuillRunService({ entry_source: 'RESEARCH' });
  await api.createQuillRunService({}, 'QIMING');
  assert.equal(http.calls[0].url, '/agents/QUILL/runs');
  assert.equal(http.calls[1].url, '/agents/QIMING/runs');
  for (const call of http.calls) assert.equal(call.payload.entry_source, 'WRITING');
  await api.getQuillConversationListService(2);
  await api.getQuillConversationService('cached-id');
  assert.equal(http.calls[2].config.params.entry_source, 'WRITING');
  assert.equal(http.calls[2].config.params.page, 2);
  assert.equal(http.calls[3].config.params.entry_source, 'WRITING');
});

test('四个研究工作台创建及历史查询固定 RESEARCH，委派模块不改变历史归属', async () => {
  const http = transport();
  const api = load('research/api/agents.ts', http);
  const payload = { request_id: 'request-test', knowledge_base_id: '9', query: '研究问题' };
  await api.createQimingRun(payload);
  await api.createZhijianRun(payload);
  await api.createSuzhiRun({ ...payload, research_topic: '研究主题' });
  await api.createRongtongRun(payload);
  for (const call of http.calls) assert.equal(call.payload.entry_source, 'RESEARCH');
  await api.fetchAgentRunHistory('SUZHI');
  assert.equal(http.calls.find(call => call.url === '/agent-runs').config.params.entry_source, 'RESEARCH');
  const conversations = load('research/api/conversations.ts', http);
  await conversations.fetchConversations();
  await conversations.fetchConversation('id');
  for (const call of http.calls.filter(call => call.url.startsWith('/conversations'))) assert.equal(call.config.params.entry_source, 'RESEARCH');
});

test('文献问答分析、追问和历史恢复固定 LITERATURE', async () => {
  const http = transport();
  const api = load('research/api/literature.ts', http);
  for (const task of ['ANALYZE', 'ASK']) {
    await api.createReadingRun({ request_id: 'request-test', query: '阅读问题', options: { task } });
    assert.equal(http.calls.at(-1).payload.entry_source, 'LITERATURE');
  }
  await api.fetchReadingConversation('id');
  assert.equal(http.calls.at(-1).config.params.entry_source, 'LITERATURE');
});

test('数据库旧调用兼容真实绑定，四个模块统一提交 RESEARCH', async () => {
  const http = transport();
  const api = load('research/api/agents.ts', http);
  const payload = { request_id: 'database-request', knowledge_base_id: '9', query: '研究问题' };
  await api.createQimingRun(payload, 'DATABASE');
  await api.createZhijianRun(payload, 'DATABASE');
  await api.createSuzhiRun({ ...payload, research_topic: '研究主题' }, 'DATABASE');
  await api.createRongtongRun(payload, 'DATABASE');
  for (const call of http.calls) {
    assert.equal(call.payload.entry_source, 'RESEARCH');
    assert.equal(call.payload.database_id, 9);
    assert.equal('knowledge_base_id' in call.payload, false);
  }
  http.calls.length = 0;
  await api.fetchAgentRunHistory('SUZHI', 1, 20, 'DATABASE');
  assert.equal(http.calls.find(call => call.url === '/agent-runs').config.params.entry_source, 'RESEARCH');
  assert.ok(http.calls.some(call => call.url === '/research-databases'));
  const conversations = load('research/api/conversations.ts', http);
  await conversations.fetchConversations(1, 20, 'DATABASE');
  await conversations.fetchConversation('database-conversation', 'DATABASE');
  for (const call of http.calls.filter(call => call.url.startsWith('/conversations'))) {
    assert.equal(call.config.params.entry_source, 'RESEARCH');
  }
});

test('数据库详情使用 database_id 恢复选择值，不与同号知识库混用', async () => {
  const http = transport();
  http.get = async (url, config) => {
    http.calls.push({ url, config });
    return { data: { data: url === '/research-databases'
      ? { items: [{ id: 9, database_name: '主题数据库' }] }
      : { id: 'history', title: '研究历史', knowledge_base_id: null, database_id: 9, messages: [] } } };
  };
  const conversations = load('research/api/conversations.ts', http);
  const record = await conversations.fetchConversation('history', 'DATABASE');
  assert.equal(record.knowledge_base_id, 'db:9');
  assert.equal(record.knowledge_base_name, '数据库 · 主题数据库');
  assert.equal(record.knowledge_base_accessible, true);
  const api = load('research/api/agents.ts', http);
  const run = await api.fetchAgentRun('history', 'DATABASE');
  assert.equal(run.knowledge_base_id, 'db:9');
  assert.equal(http.calls.at(-1).config.params.entry_source, 'RESEARCH');
});


test('固定数据库的历史及详情显式携带 database_id，沿用后端分页而不拉取全部历史', async () => {
  const http = transport();
  const api = load('research/api/agents.ts', http);
  const conversations = load('research/api/conversations.ts', http);
  await api.fetchAgentRunHistory('SUZHI', 2, 20, 'DATABASE', 9);
  await conversations.fetchConversations(3, 20, 'DATABASE', 9);
  for (const call of http.calls.filter(call => ['/agent-runs', '/conversations'].includes(call.url))) {
    assert.equal(call.config.params.database_id, 9);
    assert.equal(call.config.params.entry_source, 'RESEARCH');
    assert.equal(call.config.params.page_size, 20);
    assert.equal(call.config.params.page, call.url === '/agent-runs' ? 2 : 3);
  }
  assert.equal(http.calls.filter(call => call.url === '/conversations').length, 1);
  http.get = async (url, config) => {
    http.calls.push({ url, config });
    return { data: { data: url === '/research-databases' ? { items: [] }
      : { id: 'history', database_id: 20, messages: [] } } };
  };
  await assert.rejects(conversations.fetchConversation('wrong', 'DATABASE', 9), /不属于当前智能体/);
  await assert.rejects(api.fetchAgentRun('wrong', 'DATABASE', 9), /不属于当前智能体/);
  for (const call of http.calls.filter(call => call.url.endsWith('/wrong'))) {
    assert.equal(call.config.params.database_id, 9);
  }
});

test('固定数据库路由参数控制资源列表，刷新和模块跳转保留相同数据库范围', async () => {
  const http = transport();
  http.get = async () => ({ data: { data: { items: [
    { id: 9, database_name: '根数据库甲' }, { id: 20, database_name: '根数据库乙' },
  ] } } });
  const api = load('research/api/knowledge-bases.ts', http);
  const data = await api.fetchKnowledgeBases({ page: 1, page_size: 100 }, 'DATABASE', 20);
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].id, 'db:20');
  assert.equal(data.items[0].name, '根数据库乙');
});


test('四个模块统一研究来源，旧数据库路径参数继续保留', () => {
  const { createRouter, createMemoryHistory } = require('../node_modules/vue-router');
  const routes = load('research/routes.js', transport());
  const router = createRouter({ history: createMemoryHistory(), routes: [routes.default, routes.databaseResearchRoutes] });
  for (const code of ['qiming', 'zhijian', 'suzhi', 'rongtong']) {
    const match = router.resolve(`/database-research/20/${code}`);
    assert.equal(match.params.databaseId, '20');
    assert.equal(match.meta.researchSource, 'RESEARCH');
    assert.equal(match.name, `database-research-${code}`);
    assert.equal(router.resolve(`/research/${code}`).meta.researchSource, 'RESEARCH');
  }
  const detail = router.resolve({ name: 'database-research-conversation-detail', params: { databaseId: 20, id: 'history' } });
  assert.equal(detail.path, '/database-research/20/qiming/conversations/history');
  assert.equal(router.resolve('/database-research/qiming').name, 'database-research-qiming');
});

test('融通页面关闭时，新旧入口及详情返回启明，保留数据库范围和查询参数', async () => {
  const { createRouter, createMemoryHistory } = require('../node_modules/vue-router');
  const routes = load('research/routes.js', transport());
  assert.equal(load('research/features.ts', transport()).RONGTONG_UI_ENABLED, false);
  // 使用空页面验证实际路由跳转，避免单元测试加载浏览器专用 Vue 文件。
  const records = [routes.default, routes.databaseResearchRoutes].map(record => ({
    ...record, component: {}, children: record.children.map(child => ({ ...child, component: {} })),
  }));
  const router = createRouter({ history: createMemoryHistory(), routes: records });
  for (const prefix of ['/research', '/database-research', '/database-research/20']) {
    for (const suffix of ['', '/runs/saved-result']) {
      await router.push(`${prefix}/rongtong${suffix}?from=bookmark#answer`);
      assert.equal(router.currentRoute.value.name, 'database-research-qiming');
      assert.equal(router.currentRoute.value.params.databaseId ?? '', prefix.endsWith('/20') ? '20' : '');
      assert.equal(router.currentRoute.value.params.runId, undefined);
      assert.equal(router.currentRoute.value.query.from, 'bookmark');
      assert.equal(router.currentRoute.value.hash, '#answer');
    }
  }
});

test('全库、同号数据库和知识库选择键独立，创建统一来源并正确恢复资源', async () => {
  const http = transport();
  http.knowledgeBases = [{ id: 9, name: '同名资源', description: null, corpus_count: 1 }];
  http.get = async (url, config) => {
    http.calls.push({ url, config });
    return { data: { data: { items: [{ id: 9, database_name: '同名资源' }] } } };
  };
  const source = load('research/api/research-source.ts', http);
  const options = await source.fetchResearchResources(1, 100, 'RESEARCH');
  assert.deepEqual(Array.from(options.items, item => item.id), ['global', 'db:9', 'kb:9']);
  for (const [key, field] of [['db:9', 'database_id'], ['kb:9', 'knowledge_base_id']]) {
    const payload = source.researchPayload({ knowledge_base_id: key }, 'RESEARCH');
    assert.equal(payload.entry_source, 'RESEARCH');
    assert.equal(payload[field], 9);
    assert.equal(source.researchResourceId(payload), key);
    assert.equal(Object.keys(payload).length, 2);
  }
  const global = source.researchPayload({ knowledge_base_id: 'global' }, 'RESEARCH');
  assert.deepEqual(Object.keys(global), ['entry_source']);
  assert.equal(source.researchResourceId(global), 'global');
});

test('旧知识库模块和历史链接重定向统一路由，保留会话 ID 和查询参数', () => {
  const { createRouter, createMemoryHistory } = require('../node_modules/vue-router');
  const routes = load('research/routes.js', transport());
  const router = createRouter({ history: createMemoryHistory(), routes: [routes.default, routes.databaseResearchRoutes] });
  for (const [path, target] of [
    ['/research/qiming', 'database-research-qiming'],
    ['/research/qiming/conversations/old', 'database-research-conversation-detail'],
    ['/research/suzhi/runs/old', 'database-research-suzhi-run'],
  ]) {
    const match = router.resolve(path + '?keep=1');
    const redirected = match.matched.at(-1).redirect(match);
    assert.equal(redirected.name, target);
    assert.equal(redirected.query.keep, '1');
    if (match.params.id) assert.equal(redirected.params.id, 'old');
    if (match.params.runId) assert.equal(redirected.params.runId, 'old');
  }
});
