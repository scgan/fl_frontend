/** 验证搜索选择跨页一致性，以及追加阅读草稿时的合并、上限和返回行为。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../node_modules/typescript')
const helperExports = {}
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/research/utils/reading-selection.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, { exports: helperExports })

const source = fs.readFileSync(path.join(__dirname, '../src/views/UploadView/FileManage/FileSearch.vue'), 'utf8')
/** 装载真实搜索页面脚本，隔离接口和路由以检查用户选择是否完整传递。 */
function setup(search, options = {}) {
  const mounted = []
  const navigations = [], warnings = []
  const store = {
    rows: new Map(),
    isItemSelected(id) { return this.rows.has(String(id)) },
    addSelection(row) { this.rows.set(String(row.corpus_id || row.id), row) },
    removeSelection(id) { this.rows.delete(String(id)) },
    addMultipleSelection(rows) { rows.forEach(row => this.addSelection(row)) },
    clearSelection() { this.rows.clear() },
    get selectedIds() { return [...this.rows.keys()] },
  }
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"][^\r\n]*/gm, '')
  const context = {
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
    nextTick: fn => Promise.resolve().then(fn), watch() {}, onMounted(fn) { mounted.push(fn) },
    useRouter: () => ({ push: async target => { navigations.push(target); return options.navigationFailure } }),
    useRoute: () => ({ query: options.query || {} }), useLiteratureSelectionStore: () => store,
    mergeReadingMaterialIds: helperExports.mergeReadingMaterialIds,
    publicSearchService: search, aiChatService: search,
    ElMessage: { success() {}, warning(value) { warnings.push(value) }, error() {} }, console,
  }
  vm.createContext(context)
  vm.runInContext(script + '\nthis.api = { fileList, tableRef, total, params, resultQuery, loading, radio1, smartSearch, onCurrentChange, onSizeChange, getCorpusList, handleSelectionChange, updateTableSelection, selectAllResults, reset, onChange, onSearch, onSmart, onAiChat, returnToReading };', context)
  const api = context.api
  let checked = []
  api.tableRef.value = { clearSelection() { checked = [] }, toggleRowSelection(row) { checked.push(row.id || row.corpus_id) } }
  return { api, store, navigations, warnings, checked: () => checked, mount: () => mounted.forEach(fn => fn()) }
}
const response = (rows, total = rows.length) => ({ data: { code: 200, data: { data: rows, total } } })
/** 构造带有服务端 SQL 缓存标识的 AI 搜索响应。 */
const aiResponse = (searchId, rows, total = rows.length) => ({ data: { code: 200, data: {
  search_id: searchId, result: rows, pagination: { total },
} } })

test('AI 检索一次取回全部结果，翻页与全选改为本地完成', async () => {
  const calls = []
  const s = setup(async query => {
    calls.push({ ...query })
    const all = Array.from({ length: 46 }, (_, i) => ({ id: i + 1 }))
    const start = (query.page_num - 1) * query.page_size
    return aiResponse('a'.repeat(32), all.slice(start, start + query.page_size), 46)
  })
  s.api.radio1.value = '2'
  s.api.smartSearch.value = '双减'
  await s.api.onSmart()
  // 首次带 question 生成 SQL，第二次用同一个 search_id 一次取回全部结果
  assert.equal(calls.length, 2)
  assert.equal(calls[0].search_id, undefined)
  assert.equal(calls[0].question, '双减')
  assert.equal(calls[1].search_id, 'a'.repeat(32))
  assert.equal(calls[1].page_size, 46)
  assert.equal(s.api.fileList.value.length, 10)
  assert.equal(s.api.total.value, 46)

  // 尚未提交的新输入不影响翻页，也不会再请求后端
  s.api.smartSearch.value = '尚未提交的新问题'
  await s.api.onCurrentChange(3)
  assert.equal(calls.length, 2)
  assert.deepEqual(s.api.fileList.value.map(row => row.id), [21, 22, 23, 24, 25, 26, 27, 28, 29, 30])

  await s.api.onSizeChange(20)
  assert.equal(calls.length, 2)
  assert.equal(s.api.fileList.value.length, 20)

  await s.api.selectAllResults()
  assert.equal(calls.length, 2)
  assert.equal(s.store.rows.size, 46)
})

test('重新点击 AI 搜索创建新检索，切换模式后翻页不再提交', async () => {
  const calls = []
  const s = setup(async query => {
    calls.push({ ...query })
    return aiResponse(String(calls.length).repeat(32), [{ id: 1 }], 1)
  })
  s.api.radio1.value = '2'
  s.api.smartSearch.value = '双减'
  await s.api.onSmart()
  s.api.smartSearch.value = '教师'
  await s.api.onSmart()
  // 每次点搜索都重新生成 SQL，第二次同样不带旧标识
  assert.equal(calls.length, 2)
  assert.equal(calls[1].search_id, undefined)
  assert.equal(calls[1].question, '教师')
  await s.api.onCurrentChange(2)
  assert.equal(calls.length, 2)
  s.api.onChange()
  await s.api.onCurrentChange(2)
  assert.equal(calls.length, 2)
})

test('AI 检索标识过期时清空结果并提示重新搜索，不自动重新生成 SQL', async () => {
  let calls = 0
  const s = setup(async () => {
    calls += 1
    if (calls === 1) {
      // 首次检索结果超过本地分页上限，保持服务端分页
      return aiResponse('a'.repeat(32), Array.from({ length: 10 }, (_, i) => ({ id: i + 1 })), 800)
    }
    throw { response: { status: 410 } }
  })
  s.api.radio1.value = '2'
  s.api.smartSearch.value = '双减'
  await s.api.onSmart()
  assert.equal(calls, 1)
  assert.equal(s.api.total.value, 800)
  s.store.addSelection({ id: 1 })
  await s.api.onCurrentChange(2)
  assert.equal(s.api.fileList.value.length, 0)
  assert.equal(s.api.resultQuery.value, null)
  assert.equal(s.api.total.value, 0)
  assert.equal(s.api.loading.value, false)
  assert.equal(s.store.rows.size, 0)
  await s.api.onCurrentChange(2)
  assert.equal(calls, 2)
})

test('重新进入空白搜索页时清除遗留选择', () => {
  const s = setup(async () => response([]))
  s.store.addSelection({ id: 7 })
  s.mount()
  assert.equal(s.store.rows.size, 0)
  assert.equal(s.api.fileList.value.length, 0)
})

test('切换搜索模式清空结果时同步清除选择', async () => {
  const s = setup(async () => response([{ id: 7 }]))
  await s.api.getCorpusList({ page_num: 1 })
  await s.api.selectAllResults()
  s.api.onChange()
  assert.equal(s.store.rows.size, 0)
  assert.equal(s.api.fileList.value.length, 0)
  assert.deepEqual(s.checked(), [])
})

test('新检索返回空结果时不保留旧选择，覆盖普通和 AI 搜索', async () => {
  for (const action of ['onSearch', 'onSmart']) {
    const s = setup(async () => ({ data: { code: 200, data: {
      data: [], total: 0, result: [], pagination: { total: 0 },
    } } }))
    s.store.addSelection({ id: 7 })
    await s.api[action]()
    assert.equal(s.store.rows.size, 0)
    assert.equal(s.api.fileList.value.length, 0)
    assert.deepEqual(s.checked(), [])
  }
})

test('翻页返回、单选取消及清空保持跨页记录与显示一致', async () => {
  const s = setup(async ({ page_num }) => response(page_num === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }], 3))
  await s.api.getCorpusList({ page_num: 1 })
  s.api.handleSelectionChange(s.api.fileList.value)
  await s.api.getCorpusList({ page_num: 2 })
  s.api.handleSelectionChange(s.api.fileList.value)
  await s.api.getCorpusList({ page_num: 1 })
  assert.deepEqual(s.checked(), [1, 2])
  s.api.handleSelectionChange([{ id: 2 }])
  assert.deepEqual(s.store.selectedIds.sort(), ['2', '3'])
  s.api.reset()
  assert.deepEqual(s.checked(), [])
  assert.equal(s.store.rows.size, 0)
  assert.match(source, /@select="handleSelectionChange"/)
  assert.match(source, /@select-all="handleSelectionChange"/)
  assert.doesNotMatch(source, /@selection-change=/)
})

test('完整结果直接全选，普通和 AI 搜索均不重复请求', async () => {
  for (const mode of ['1', '2']) {
    let calls = 0
    const s = setup(async () => { calls += 1; throw new Error('不应重新检索') })
    s.api.fileList.value = Array.from({ length: 7 }, (_, i) => ({ id: i + 1 }))
    s.api.total.value = 7
    s.api.resultQuery.value = { mode, params: {} }
    s.store.addSelection({ id: 200 })
    await s.api.selectAllResults()
    assert.equal(calls, 0)
    assert.equal(s.store.rows.size, 8)
    assert.deepEqual(s.checked(), [1, 2, 3, 4, 5, 6, 7])
    s.api.reset()
    assert.equal(s.store.rows.size, 0)
    assert.deepEqual(s.checked(), [])
  }
})

test('全选使用已提交查询获取全部分页，保留原有选择', async () => {
  const calls = []
  const s = setup(async query => {
    calls.push(query)
    return response(query.page_num === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })) : [{ id: 101 }], 101)
  })
  await s.api.getCorpusList({ page_num: 1, keyword_cn: ['原条件'] })
  s.api.params.value.keyword_cn = ['尚未检索']
  s.store.addSelection({ id: 200 })
  await s.api.selectAllResults()
  assert.equal(s.store.rows.size, 102)
  assert.equal(calls.at(-1).page_num, 2)
  assert.equal(calls.at(-1).keyword_cn[0], '原条件')
})

test('全选中途失败不保存部分结果', async () => {
  const s = setup(async query => {
    if (query.page_num === 2) throw new Error('network')
    return response(Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })), 101)
  })
  await s.api.getCorpusList({ page_num: 1 })
  s.store.addSelection({ id: 200 })
  await s.api.selectAllResults()
  assert.deepEqual(s.store.selectedIds, ['200'])
})

test('切换模式后忽略尚未完成的全选响应', async () => {
  let resolve
  const s = setup(() => new Promise(done => { resolve = done }))
  s.api.fileList.value = [{ id: 1 }]
  s.api.total.value = 2
  s.api.resultQuery.value = { mode: '1', params: {} }
  const pending = s.api.selectAllResults()
  s.api.onChange()
  resolve(response([{ id: 1 }]))
  await pending
  assert.equal(s.store.rows.size, 0)
})

test('全局搜索追加到已有本地草稿，去重并返回选材页而非直接开始分析', async () => {
  const s = setup(async () => response([]), { query: { reading: '1', materials: '100,2' } })
  s.store.addMultipleSelection([{ id: 2 }, { id: 3 }])
  await s.api.onAiChat()
  assert.equal(s.navigations[0].name, 'literatureDetail')
  assert.equal(s.navigations[0].query.draft, '100,2,3')
  assert.equal('ids' in s.navigations[0].query, false)
  assert.equal(s.store.rows.size, 0)
})

test('混合材料超过二十篇时整批拒绝，保留搜索选择与已有草稿', async () => {
  const s = setup(async () => response([]), {
    query: { reading: '1', materials: Array.from({ length: 20 }, (_, i) => i + 1).join(',') },
  })
  s.store.addSelection({ id: 21 })
  await s.api.onAiChat()
  assert.equal(s.navigations.length, 0)
  assert.equal(s.store.rows.size, 1)
  assert.match(s.warnings[0], /20/)
})

test('取消搜索返回完整原草稿，普通搜索选文也先进入材料清单', async () => {
  const picker = setup(async () => response([]), { query: { reading: '1', materials: '100,2' } })
  await picker.api.returnToReading()
  assert.equal(picker.navigations[0].query.draft, '100,2')
  const direct = setup(async () => response([]))
  direct.store.addSelection({ id: 3 })
  await direct.api.onAiChat()
  assert.equal(direct.navigations[0].query.draft, '3')
  assert.equal('ids' in direct.navigations[0].query, false)
})

test('返回选材页被路由守卫拒绝时不清空已选文献', async () => {
  const s = setup(async () => response([]), { navigationFailure: { type: 4 } })
  s.store.addSelection({ id: 3 })
  await s.api.onAiChat()
  assert.equal(s.store.rows.size, 1)
})
