/** 用真实页面脚本及 Vue 按钮渲染验证选择恢复、同组分析锁定、跨页和跳转竞态。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const vue = require('../node_modules/vue')
const ts = require('../node_modules/typescript')
const { compileTemplate } = require('../node_modules/@vue/compiler-sfc')
const { renderToString } = require('../node_modules/@vue/server-renderer')
const helpers = import('../src/research/utils/reading-card-state.js')
const materials = import('../src/research/utils/reading-materials.js')
const source = fs.readFileSync(path.join(__dirname,
  '../src/views/UploadView/FileManage/IntelligentAgent.vue'), 'utf8')

/** 模拟同一标签页在路由卸载、刷新后的持久存储，不依赖实际浏览器账号。 */
function storage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key) }
}

/** 题录带原始来源字段，使恢复测试同时检查真实 ID 及跨页选择。 */
function document(id) { return { corpus_id: id, title: `文献${id}` } }

/** 建立十篇一页的真实搜索结果快照。 */
function search(id = 'source') {
  return { id, status: 'SUCCESS', query: '查找双减文献', result_payload: { payload: {
    intent: 'SEARCH', search_plan: { concepts: [['双减']] }, total: 30,
    documents: Array.from({ length: 10 }, (_, i) => document(i + 1)),
  } } }
}

/** 同会话阅读保存真实来源和实际材料，按此恢复选择并阻止同组重复分析。 */
function analysis(ids, status = 'SUCCESS', page = 1) {
  return { id: 'analysis', status, request_payload: { reading_context: {
    source_run_id: 'source', selected_ids: ids, page,
  } }, result_payload: { payload: { intent: 'READING', reading_result: {
    status: 'SUCCESS', task: 'ANALYZE', source_run_id: 'source', source_kind: 'SELECTED',
    corpus_ids: ids, source_documents: ids.map(document),
  } } } }
}

/** 装载实际页面脚本，保留 Vue 响应式及业务函数，只替换网络、路由和浏览器对象。 */
async function setup(runs, saved = storage(), options = {}) {
  const h = await helpers
  const m = await materials
  const state = h.createReadingCardState(() => saved)
  const navigations = [], calls = [], warnings = []
  const route = { path: '/agent/c/conversation', params: { conversationId: 'conversation' } }
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"][^\r\n]*/gm, '')
  const context = {
    ...vue, watch() {}, onMounted() {}, onBeforeUnmount() {},
    useRoute: () => route, useRouter: () => ({
      replace: async target => { route.path = target },
      push: async target => { navigations.push(target); return options.navigate?.(target) },
    }),
    localStorage: saved, ...h, ...m, readingCardState: state,
    collectWritingActions: () => ({}), writingActionLocked: () => false,
    writingQuestion: turn => turn.query || '',
    createClientUuid: () => 'test-request-1234',
    ElMessage: { warning: text => warnings.push(text), error: text => warnings.push(text) },
    http: { get: async (url, config) => {
      calls.push({ url, config })
      if (options.get) return options.get(url, config)
      if (url.startsWith('/conversations/')) return { data: { data: {
        database_id: null, assistant_runs: structuredClone(runs),
      } } }
      if (url === '/conversations') return { data: { data: { items: [], total: 0 } } }
      if (url.endsWith('/documents')) return { data: { data: {
        documents: Array.from({ length: 10 }, (_, i) => document((config.params.page - 1) * 10 + i + 1)),
        total: 30,
      } } }
      return { data: { data: { id: 'independent', status: options.runStatus || 'SUCCESS',
        request_payload: { task: 'ANALYZE', corpus_ids: options.runIds || [1, 2, 3, 4] } } } }
    } },
    window: { history: { state: {} } }, console, setTimeout, clearTimeout,
  }
  vm.createContext(context)
  vm.runInContext(script + '\nthis.api = { turns, busy, conversation, openChat, newChat, handoff, canHandoff, readingActionLabel, selectDocument, selectDocumentPage, setDocumentTable, changeDocumentPage, refreshReadingActions };', context)
  return { api: context.api, state, navigations, calls, warnings, saved }
}

/** 执行实际表格的公开选择方法，验证程序恢复确实将四个 ID 勾回表格。 */
async function checkedRows(api, turn) {
  const checked = new Set()
  api.setDocumentTable(turn, { clearSelection() { checked.clear() },
    toggleRowSelection(row, value) { if (value) checked.add(row.corpus_id); else checked.delete(row.corpus_id) } })
  await vue.nextTick()
  return checked
}

/** 编译并渲染页面中的真实问答按钮，检查 disabled 属性和文案，而非只测工具函数。 */
async function buttonHtml(api, turn) {
  const button = source.match(/<button\s+class="action-button primary"[\s\S]*?<\/button>/)[0]
  const compiled = compileTemplate({ source: button, id: 'reading-action', filename: 'IntelligentAgent.vue' })
  assert.deepEqual(compiled.errors, [])
  const exports = {}
  vm.runInNewContext(ts.transpileModule(compiled.code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: () => vue })
  const app = vue.createSSRApp({ render: exports.render, setup: () => ({
    turn, canHandoff: api.canHandoff, handoff: api.handoff, readingActionLabel: api.readingActionLabel,
  }) })
  app.component('ChatLineRound', { render: () => null })
  return renderToString(app)
}

test('离开后恢复同会话：四篇勾选保留，已分析的同组按钮真正禁用', async () => {
  const page = await setup([search(), analysis([1, 2, 3, 4])])
  await page.api.openChat('conversation')
  const turn = page.api.turns.value[0]
  assert.deepEqual(Array.from(turn.selected, row => row.corpus_id), [1, 2, 3, 4])
  assert.deepEqual([...await checkedRows(page.api, turn)], [1, 2, 3, 4])
  const html = await buttonHtml(page.api, turn)
  assert.match(html, /disabled/)
  assert.match(html, /已分析所选文献/)
  await page.api.handoff(turn)
  assert.equal(page.navigations.length, 0)
})

test('同样四篇换勾选顺序仍锁定，改选其他组合可发起，清空后不可发起', async () => {
  const page = await setup([search(), analysis([1, 2, 3, 4])])
  await page.api.openChat('conversation')
  const turn = page.api.turns.value[0]
  turn.selected = [4, 3, 2, 1].map(document)
  assert.equal(page.api.canHandoff(turn), false)
  page.api.selectDocument(turn, [], document(4))
  page.api.selectDocument(turn, [document(5)], document(5))
  assert.equal(page.api.canHandoff(turn), true)
  assert.doesNotMatch(await buttonHtml(page.api, turn), /disabled/)
  await page.api.handoff(turn)
  assert.equal(page.navigations.length, 1)
  assert.equal(page.navigations[0].query.ids, '3,2,1,5')
  turn.selected = []
  assert.match(await buttonHtml(page.api, turn), /disabled/)
  await page.api.handoff(turn)
  assert.equal(page.navigations.length, 1)
})

test('跨页的四篇与原页码恢复，当前页只勾选本页，其他页的选择不丢失', async () => {
  const page = await setup([search(), analysis([1, 12, 13, 14], 'SUCCESS', 2)])
  await page.api.openChat('conversation')
  const turn = page.api.turns.value[0]
  assert.equal(turn.documentPage, 2)
  assert.deepEqual([...await checkedRows(page.api, turn)], [12, 13, 14])
  assert.equal(turn.selected.length, 4)
  await page.api.changeDocumentPage(turn, 1)
  assert.deepEqual([...await checkedRows(page.api, turn)], [1])
  assert.equal(turn.selected.length, 4)
  assert.equal(page.api.canHandoff(turn), false)
})

test('未提交的勾选跨路由保留，明确清空的草稿覆盖历史勾选，不影响其他来源', async () => {
  const saved = storage()
  const first = await setup([search()], saved)
  await first.api.openChat('conversation')
  const turn = first.api.turns.value[0]
  first.api.selectDocumentPage(turn, [1, 2, 3, 4].map(document))
  const restored = await setup([search()], saved)
  await restored.api.openChat('conversation')
  assert.equal(restored.api.turns.value[0].selected.length, 4)
  restored.api.selectDocumentPage(restored.api.turns.value[0], [])
  const cleared = await setup([search(), analysis([1, 2, 3, 4]), search('other')], saved)
  await cleared.api.openChat('conversation')
  assert.equal(cleared.api.turns.value[0].selected.length, 0)
  assert.equal(cleared.api.turns.value[2].selected.length, 0)
})

test('独立阅读的真实终态回查：完成锁定，失败或取消允许重试', async () => {
  for (const status of ['SUCCESS', 'FAILED', 'CANCELLED', 'RUNNING']) {
    const saved = storage()
    const helper = (await helpers).createReadingCardState(() => saved)
    helper.select('source', [1, 2, 3, 4].map(document))
    helper.record('source', [1, 2, 3, 4], { id: 'independent', status: 'PENDING' })
    const page = await setup([search()], saved, { runStatus: status })
    await page.api.openChat('conversation')
    await page.api.refreshReadingActions(1)
    assert.equal(page.api.canHandoff(page.api.turns.value[0]), ['FAILED', 'CANCELLED'].includes(status))
    assert.equal(helper.cachedAction('source', [4, 3, 2, 1]).status, status)
  }
})

test('连续点击只发生一次跳转，跳转失败不会留下永久提交锁', async () => {
  let fail
  const navigation = new Promise((_, reject) => { fail = reject })
  const page = await setup([search()], storage(), { navigate: () => navigation })
  await page.api.openChat('conversation')
  const turn = page.api.turns.value[0]
  page.api.selectDocumentPage(turn, [1, 2, 3, 4].map(document))
  const first = page.api.handoff(turn)
  await page.api.handoff(turn)
  assert.equal(page.navigations.length, 1)
  fail(new Error('navigation failed'))
  await first
  assert.equal(page.api.canHandoff(turn), true)
})

test('浏览器禁用存储不阻止选择和状态处理，缓存不保存题录或正文', async () => {
  const { createReadingCardState, readingAnalysisLocked } = await helpers
  const state = createReadingCardState(() => { throw new Error('storage disabled') })
  state.select('source', [document(1), document(2)])
  state.record('source', [1, 2], { id: 'analysis', status: 'SUCCESS' })
  const turns = [{ ...search(), documents: [document(1), document(2)] }]
  state.restore(turns)
  assert.equal(turns[0].selected.length, 2)
  assert.equal(readingAnalysisLocked(state.action(turns, 'source', [2, 1])), true)
  state.forget('source')
  assert.equal(state.cachedAction('source', [1, 2]), undefined)
})
