/** 验证文献阅读顶部进度按真实 Run 隔离，覆盖两组切换、快照恢复和迟到响应。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const vue = require('../node_modules/vue')
const ts = require('../node_modules/typescript')
const { compileTemplate } = require('../node_modules/@vue/compiler-sfc')
const { renderToString } = require('../node_modules/@vue/server-renderer')
const helpers = import('../src/research/utils/literature-progress.js')
const source = fs.readFileSync(path.join(__dirname, '../src/views/UploadView/FileManage/LiteratureDetail.vue'), 'utf8')

/** 手动控制请求完成顺序，复现切组后上一组才返回的真实竞态。 */
function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

/** 创建不同材料组和独立分析任务，步骤来自服务端持久化快照。 */
function snapshot(group, node = 'AnalyzeDocuments', sequence = 2, status = 'RUNNING') {
  return { id: `run-${group}`, conversation_id: group, status,
    request_payload: { task: 'ANALYZE', corpus_ids: group === 'A' ? [11, 12] : [21, 22] },
    steps: [{ sequence, node_name: node, status: 'RUNNING' }],
    result_payload: status === 'SUCCESS' ? { payload: {
      documents: [{ corpus_id: group === 'A' ? 11 : 21, analysis: {} }],
      recommended_questions: [`${group}的问题`],
    } } : null,
  }
}

/** 清空请求和 Vue 更新微任务，不等待真实网络或定时器。 */
async function flush() { await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() }

/** 执行真实页面脚本，保留 Vue 响应式；仅替换接口、路由和原文文件依赖。 */
async function page(options = {}) {
  const progressHelpers = await helpers
  const route = { query: { conversation: 'A' } }
  const runs = new Map([['run-A', snapshot('A')], ['run-B', snapshot('B', 'ReadMaterials', 1)]])
  const streams = [], reads = [], restores = [], unmount = [], requests = []
  const apiMocks = {
    createReadingRun: async request => {
      requests.push(request)
      return options.accept ? options.accept(request) : { conversation_id: 'A', run_id: 'run-A' }
    },
    fetchReadingRun: async id => {
      reads.push(id)
      const override = options.read?.(id, reads)
      return override === undefined ? structuredClone(runs.get(id)) : override
    },
    fetchReadingConversation: async id => {
      restores.push(id)
      const override = options.restore?.(id, restores)
      if (override !== undefined) return override
      return { reading_runs: [structuredClone(runs.get(`run-${id}`))], messages: [] }
    },
  }
  const exports = {}
  const mocks = {
    vue: { ...vue, watch() {}, onBeforeUnmount: fn => unmount.push(fn) },
    'vue-router': { useRoute: () => route, useRouter: () => ({
      replace: async target => { route.query = target.query }, push: async target => { route.query = target.query },
    }) },
    'pdfjs-dist/legacy/build/pdf.js': { GlobalWorkerOptions: {} },
    '@/research/api/literature': apiMocks,
    '@/research/api/literature-files': { fetchReadingMaterial: async id => ({
      id, title_cn: `材料${id}`, attachment: [], index: { status: 'SUCCESS' },
    }) },
    '@/research/api/agents': { streamAgentRun: (id, emit, signal) => {
      const pending = deferred()
      streams.push({ id, emit, signal, ...pending })
      return pending.promise
    } },
    '@/research/utils/client-id': { createClientUuid: () => 'request' },
    '@/research/utils/reading-card-state': { readingCardState: { record() {} } },
    '@/research/utils/literature-progress': progressHelpers,
  }
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
  vm.runInNewContext(ts.transpileModule(script + '\nexport { initialize, start, restore, progress, progressRun, activeRun, busy, error, analysis, questions }; export const currentEpoch = () => epoch;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: id => mocks[id] || {}, AbortController,
    localStorage: { getItem: () => '2' },
  })
  return { api: exports, runs, streams, reads, restores, route, requests,
    /** 从历史切换到某一组，直接使用真实 initialize 和 follow 流程。 */
    async open(group) { route.query = { conversation: group }; await exports.initialize(); await flush() },
    /** 渲染真实顶部进度元素，检查可见文案属于当前材料组。 */
    async html() {
      const template = source.match(/<div v-if="busy" class="progress" role="status">[\s\S]*?<\/div>/)[0]
      const compiled = compileTemplate({ source: template, filename: 'LiteratureDetail.vue', id: 'reading-progress' })
      assert.deepEqual(compiled.errors, [])
      const output = {}
      vm.runInNewContext(ts.transpileModule(compiled.code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText, { exports: output, require: () => vue })
      const app = vue.createSSRApp({ render: output.render, setup: () => ({ busy: exports.busy, progress: exports.progress }) })
      app.component('el-icon', { render: () => null })
      app.component('Loading', { render: () => null })
      return renderToString(app)
    },
    /** 模拟卸载后释放所有悬挂的订阅，旧响应必须无权修改页面。 */
    async close() { unmount.forEach(fn => fn()); streams.forEach(stream => stream.resolve()); await flush() },
  }
}

test('两组 A→B→A 顶部进度立即恢复各自步骤，同 Run 的旧订阅也不能覆盖新订阅', async () => {
  const view = await page()
  await view.open('A')
  assert.match(await view.html(), /正在分析文献/)
  const originalA = view.streams[0]
  originalA.emit({ event: 'node.started', data: { node: 'SynthesizeReading', sequence: 3 } })
  assert.match(await view.html(), /正在整理综合分析/)
  await view.open('B')
  assert.equal(originalA.signal.aborted, true)
  assert.match(await view.html(), /正在读取所选文献/)
  originalA.emit({ event: 'node.started', data: { node: 'FinalizeReading', sequence: 99 } })
  assert.match(await view.html(), /正在读取所选文献/)
  view.runs.set('run-A', snapshot('A', 'RecommendLiterature', 4))
  const previousB = view.streams[1]
  await view.open('A')
  assert.match(await view.html(), /正在检索库内推荐文献/)
  originalA.emit({ event: 'node.started', data: { node: 'ReadMaterials', sequence: 999 } })
  previousB.reject(new Error('B 的旧连接失败'))
  await flush()
  assert.match(await view.html(), /正在检索库内推荐文献/)
  assert.equal(view.api.error.value, '')
  assert.equal(view.api.busy.value, true)
  assert.equal(view.api.progressRun.value.id, 'run-A')
  await view.close()
})

test('上一组快照晚于切换返回，不覆盖下一组的阶段、材料和忙碌状态', async () => {
  const oldSnapshot = deferred()
  const view = await page({ read: id => id === 'run-A' ? oldSnapshot.promise : undefined })
  await view.open('A')
  await view.open('B')
  oldSnapshot.resolve(snapshot('A', 'SynthesizeReading', 7))
  await flush()
  assert.match(await view.html(), /正在读取所选文献/)
  assert.equal(view.api.activeRun.value, 'run-B')
  assert.equal(view.api.busy.value, true)
  assert.equal(view.api.error.value, '')
  assert.deepEqual(Array.from(view.api.progressRun.value.request_payload.corpus_ids), [21, 22])
  await view.close()
})

test('上一组终态回包和异常晚返回，都不能结束当前另一组的加载或覆盖结果', async () => {
  for (const fails of [false, true]) {
    const finalResponse = deferred()
    const view = await page({ read: (id, reads) => id === 'run-A'
      && reads.filter(item => item === id).length > 1 ? finalResponse.promise : undefined })
    await view.open('A')
    view.streams[0].resolve()
    await flush()
    await view.open('B')
    if (fails) finalResponse.reject(new Error('A 的终态读取失败'))
    else finalResponse.resolve(snapshot('A', 'FinalizeReading', 8, 'SUCCESS'))
    await flush()
    assert.match(await view.html(), /正在读取所选文献/)
    assert.equal(view.api.progressRun.value.id, 'run-B')
    assert.equal(view.api.busy.value, true)
    assert.equal(view.api.analysis.value, null)
    assert.equal(view.api.error.value, '')
    await view.close()
  }
})

test('同会话新请求建立独立代次，上一轮恢复历史的晚响应不能覆盖本轮状态', async () => {
  const oldHistory = deferred()
  let delayHistory = false
  const view = await page({ restore: () => delayHistory ? oldHistory.promise : undefined })
  view.runs.set('run-A', snapshot('A', 'FinalizeReading', 8, 'SUCCESS'))
  await view.open('A')
  const oldEpoch = view.api.currentEpoch()
  delayHistory = true
  const oldRestore = view.api.restore('A', oldEpoch)
  view.runs.set('run-A', snapshot('A', 'ReadMaterials', 1))
  const pending = view.api.start('ANALYZE')
  await flush()
  assert.ok(view.api.currentEpoch() > oldEpoch)
  oldHistory.resolve({ reading_runs: [snapshot('A', 'FinalizeReading', 8, 'SUCCESS')], messages: [] })
  await oldRestore
  assert.match(await view.html(), /正在读取所选文献/)
  assert.equal(view.api.busy.value, true)
  await view.close()
  await pending
})

test('已完成或失败的恢复快照直接使用真实终态，不重建分析或订阅旧加载状态', async () => {
  for (const status of ['SUCCESS', 'FAILED', 'CANCELLED']) {
    const view = await page({ restore: (_id, calls) => calls.length === 1 ? {
      reading_runs: [snapshot('A')], messages: [],
    } : undefined })
    view.runs.set('run-A', snapshot('A', 'FinalizeReading', 8, status))
    await view.open('A')
    assert.equal(view.api.busy.value, false)
    assert.equal(view.api.progress.value, '')
    assert.equal(view.streams.length, 0)
    assert.equal(view.requests.length, 0)
    if (status === 'SUCCESS') assert.ok(view.api.analysis.value)
    else assert.match(view.api.error.value, /分析未完成/)
    await view.close()
  }
})

test('快照已结束的步骤不被 SSE 重放回退，完成事件更新提示，并行文献保留实际活跃步骤', async () => {
  const { literatureProgressLabel: label, mergeLiteratureProgress: merge } = await helpers
  let current = { ...snapshot('A'), steps: [
    { sequence: 1, node_name: 'ReadMaterials', status: 'SUCCESS' },
    { sequence: 2, node_name: 'AnalyzeDocument:11', status: 'RUNNING' },
    { sequence: 3, node_name: 'AnalyzeDocument:12', status: 'SUCCESS' },
  ] }
  assert.equal(label(current), '正在分析文献')
  assert.equal(merge(current, 'run-B', { event: 'node.started', data: { node: 'ReadMaterials', sequence: 99 } }), current)
  assert.equal(merge(current, 'run-A', { event: 'node.started', data: { node: 'ReadMaterials', sequence: 1 } }), current)
  current = merge(current, 'run-A', { event: 'node.completed', data: { node: 'AnalyzeDocument:11', sequence: 2 } })
  assert.equal(label(current), '正在衔接下一步处理')
  current = merge(current, 'run-A', { event: 'node.started', data: { node: 'SynthesizeReading', sequence: 4 } })
  assert.equal(label(current), '正在整理综合分析与文献推荐')
  assert.equal(merge(current, 'run-A', { event: 'node.started', data: { node: 'OldNode', sequence: 0 } }), current)
  assert.equal(label({ ...current, status: 'SUCCESS' }), '')
})
