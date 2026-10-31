/** 验证ASK目标子集、新旧快照和后续篇目顺序使用同一投影，不以原阅读集合误报数量。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const api = import('../src/research/utils/reading-materials.js')

test('点名一篇时，原集合两篇的旧快照也只展示目标一篇', async () => {
  const { readingDocuments, assistantDocuments } = await api
  const docs = [{ corpus_id: 11, title: '家庭教育' }, { corpus_id: 12, title: '政策实施' }]
  const reading = { task: 'ASK', source_documents: docs, target_corpus_ids: [12] }
  assert.deepEqual(readingDocuments(reading), [docs[1]])
  assert.deepEqual(assistantDocuments({ documents: docs, reading_result: reading }), [docs[1]])
  assert.equal(docs.length, 2)
})

test('比较两篇保留原顺序，分析和旧版无目标快照保持完整集合', async () => {
  const { readingDocuments } = await api
  const docs = [{ corpus_id: 11 }, { corpus_id: 12 }]
  assert.deepEqual(readingDocuments({ task: 'ASK', source_documents: docs,
    target_corpus_ids: [12, 11] }), docs)
  assert.deepEqual(readingDocuments({ task: 'ANALYZE', source_documents: docs }), docs)
  assert.deepEqual(readingDocuments({ task: 'ASK', source_documents: docs }), docs)
})

test('引用未知目标不回退整个集合，题录分页与普通研究候选不受影响', async () => {
  const { readingDocuments, assistantDocuments } = await api
  assert.deepEqual(readingDocuments({ task: 'ASK', source_documents: [{ corpus_id: 11 }],
    target_corpus_ids: [999] }), [])
  const docs = Array.from({ length: 12 }, (_, i) => ({ corpus_id: i + 1 }))
  assert.equal(assistantDocuments({ search_plan: {}, documents: docs }).length, 10)
  assert.deepEqual(assistantDocuments({ documents: docs }), docs)
})

test('旧搜索结果被重新勾选后，提交携带旧卡的当前页和跨页选择，不误用最新结果', async () => {
  const { activeReadingContext } = await api
  const older = { id: 'older', status: 'SUCCESS', documents: [{ corpus_id: 12 }],
    documentPage: 2, selected: [{ corpus_id: 11 }, { corpus_id: 12 }] }
  const newer = { id: 'newer', status: 'SUCCESS', documents: [{ corpus_id: 21 }], selected: [] }
  assert.deepEqual(activeReadingContext([older, newer], 'older'), {
    source_run_id: 'older', page: 2, selected_ids: [11, 12],
  })
  older.selected = []
  assert.deepEqual(activeReadingContext([older, newer], 'older').selected_ids, [])
  assert.equal(activeReadingContext([older, newer], null).source_run_id, 'newer')
  assert.equal(activeReadingContext([newer], 'older').source_run_id, 'newer')
  assert.equal(activeReadingContext([], 'older'), null)
})

test('未完成或失败结果不能盖掉最后有效的文献来源', async () => {
  const { activeReadingContext } = await api
  const valid = { id: 'valid', status: 'SUCCESS', documents: [{ corpus_id: 11 }] }
  for (const status of ['RUNNING', 'FAILED', 'PENDING']) {
    assert.equal(activeReadingContext([valid, { id: 'bad', status, documents: [{ corpus_id: 99 }] }],
      'bad').source_run_id, 'valid')
  }
})
