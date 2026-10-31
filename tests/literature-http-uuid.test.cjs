/** 普通 HTTP 缺少 randomUUID 时，文献分析与追问仍能发出合法请求。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { webcrypto } = require('node:crypto')
const ts = require('../node_modules/typescript')
const vue = require('../node_modules/vue')

/** 编译真实页面脚本，仅替换浏览器依赖和接口。 */
function compile(source, mocks, crypto) {
  const exports = {}
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { exports, require: (id) => mocks[id] || {}, crypto, AbortController })
  return exports
}

test('HTTP 文献分析和继续提问使用随机 UUID，不依赖 randomUUID', async () => {
  const crypto = { getRandomValues: (bytes) => webcrypto.getRandomValues(bytes) }
  const helper = compile(fs.readFileSync(path.join(__dirname, '../src/research/utils/client-id.ts'), 'utf8'), {}, crypto)
  const source = fs.readFileSync(path.join(__dirname, '../src/views/UploadView/FileManage/LiteratureDetail.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1]
  const requests = []
  const currentRun = () => ({
    id: 'run', status: 'SUCCESS',
    request_payload: { task: requests.at(-1).options.task, corpus_ids: [42] },
    result_payload: { payload: { documents: [{ analysis: {} }], recommended_questions: [] } },
  })
  const page = compile(source + '\nexport { start, ids, analysis, error };', {
    vue: { ...vue, watch() {}, onMounted() {}, onBeforeUnmount() {} },
    'vue-router': { useRoute: () => ({ query: {} }), useRouter: () => ({ replace: async () => {} }) },
    'pdfjs-dist/legacy/build/pdf.js': { GlobalWorkerOptions: {} },
    '@/research/utils/client-id': helper,
    '@/research/api/agents': { streamAgentRun: async () => {} },
    '@/research/api/literature': {
      createReadingRun: async (request) => {
        requests.push(request)
        return { conversation_id: 'conversation', run_id: 'run' }
      },
      fetchReadingRun: async () => currentRun(),
      fetchReadingConversation: async () => ({ reading_runs: [currentRun()], messages: [] }),
    },
  }, crypto)
  page.ids.value = [42]
  await page.start('ANALYZE')
  assert.equal(page.error.value, '')
  await page.start('ASK', '这篇文献的核心观点是什么？')
  assert.equal(page.error.value, '')
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map((request) => request.options.task), ['ANALYZE', 'ASK'])
  for (const request of requests) {
    assert.match(request.request_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  }
  assert.notEqual(requests[0].request_id, requests[1].request_id)
})

test('独立阅读保留来源卡参数并回写分析终态，继续追问不覆盖初次分析', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/views/UploadView/FileManage/LiteratureDetail.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1]
  const recorded = [], routes = [], requests = [], runs = []
  const currentRun = () => runs.at(-1)
  const page = compile(source + '\nexport { start, ids, readingSourceId, error };', {
    vue: { ...vue, watch() {}, onBeforeUnmount() {} },
    'vue-router': { useRoute: () => ({ query: {} }), useRouter: () => ({ replace: async target => routes.push(target) }) },
    'pdfjs-dist/legacy/build/pdf.js': { GlobalWorkerOptions: {} },
    '@/research/utils/client-id': { createClientUuid: () => 'request' },
    '@/research/utils/reading-card-state': { readingCardState: { record: (sourceId, ids, run) =>
      recorded.push({ sourceId, ids: [...ids], status: run.status }) } },
    '@/research/api/agents': { streamAgentRun: async () => {} },
    '@/research/api/literature': {
      createReadingRun: async request => {
        requests.push(request)
        runs.push({ id: `run-${runs.length}`, status: 'SUCCESS', request_payload: request.options,
          result_payload: { payload: { documents: [{ analysis: {} }], recommended_questions: [] } } })
        return { conversation_id: 'conversation', run_id: currentRun().id, status: 'PENDING' }
      },
      fetchReadingRun: async id => runs.find(run => run.id === id),
      fetchReadingConversation: async () => ({ reading_runs: runs, messages: [] }),
    },
  })
  page.ids.value = [1, 2, 3, 4]
  page.readingSourceId.value = 'source'
  await page.start('ANALYZE')
  assert.equal(page.error.value, '')
  assert.equal(recorded[0].status, 'PENDING')
  assert.equal(recorded.at(-1).status, 'SUCCESS')
  await page.start('ASK', '比较研究方法')
  assert.equal(page.error.value, '')
  assert.deepEqual(requests.map(request => request.options.task), ['ANALYZE', 'ASK'])
  assert.ok(recorded.every(item => item.sourceId === 'source' && item.status !== 'FAILED'))
  assert.ok(routes.every(item => item.query.source_run === 'source' && item.query.ids === '1,2,3,4'))
  assert.equal(recorded.filter(item => item.status === 'PENDING').length, 1)
})

test('离开阅读页时仍保存稍后接受的真实运行，不把来源及四篇改记到新页面', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/views/UploadView/FileManage/LiteratureDetail.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1]
  let accept
  const accepted = new Promise(resolve => { accept = resolve })
  const recorded = [], routes = []
  const page = compile(source + '\nexport { start, ids, readingSourceId }; export function depart() { ++epoch; ids.value = [99]; readingSourceId.value = "other"; }', {
    vue: { ...vue, watch() {}, onBeforeUnmount() {} },
    'vue-router': { useRoute: () => ({ query: {} }), useRouter: () => ({ replace: async target => routes.push(target) }) },
    'pdfjs-dist/legacy/build/pdf.js': { GlobalWorkerOptions: {} },
    '@/research/utils/client-id': { createClientUuid: () => 'request' },
    '@/research/utils/reading-card-state': { readingCardState: { record: (sourceId, ids, run) =>
      recorded.push({ sourceId, ids: [...ids], run }) } },
    '@/research/api/literature': { createReadingRun: async () => accepted },
  })
  page.ids.value = [1, 2, 3, 4]
  page.readingSourceId.value = 'source'
  const pending = page.start('ANALYZE')
  page.depart()
  accept({ conversation_id: 'old-conversation', run_id: 'accepted-run', status: 'RUNNING' })
  await pending
  assert.equal(recorded.length, 1)
  assert.equal(recorded[0].sourceId, 'source')
  assert.deepEqual(recorded[0].ids, [1, 2, 3, 4])
  assert.equal(recorded[0].run.id, 'accepted-run')
  assert.equal(recorded[0].run.status, 'RUNNING')
  assert.equal(routes.length, 0)
})
