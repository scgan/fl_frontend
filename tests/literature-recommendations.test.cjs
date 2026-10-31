/** 库内和联网文献同屏展示，空 corpus_id 的联网条目不能互相覆盖。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../node_modules/typescript')
const source = fs.readFileSync(path.join(__dirname, '../src/research/utils/literature-recommendations.ts'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const api = {}
vm.runInNewContext(code, { exports: api, URL, URLSearchParams })

function web(doi, title) {
  return { corpus_id: null, origin: 'WEB', doi, title, external_url: 'https://doi.org/' + doi }
}

test('保留多篇无库内 ID 的联网论文，排除已选、重复题名及重复 DOI', () => {
  const items = api.displayRecommendations([
    { corpus_id: 1, title: 'Selected paper' },
    { corpus_id: 2, title: 'Library paper' },
    { corpus_id: 2, title: 'Another label for the same library item' },
    web('10.1234/one', 'First external paper'),
    web('10.1234/two', 'Second external paper'),
    web('10.1234/one', 'Same DOI with another title'),
    web('10.1234/three', 'Library Paper!'),
  ], [1])
  assert.equal(items.length, 3)
  assert.equal(items.filter(item => item.origin === 'WEB').length, 2)
})

test('联网链接拒绝脚本，库内链接继续使用原有附件接口', () => {
  const unsafe = { ...web('10.1234/x', 'Unsafe paper'), external_url: 'javascript:alert(1)' }
  assert.equal(api.recommendationLink(unsafe), '')
  assert.equal(api.displayRecommendations([unsafe], []).length, 0)
  assert.equal(api.recommendationLink({ corpus_id: 3, attachment_paths: ['paper 3.pdf'] }),
    '/api/public/file/corpus?corpus_id=3&attachment_path=paper+3.pdf')
  assert.equal(api.recommendationLink(web('10.1234/one', 'External paper')), 'https://doi.org/10.1234/one')
})

test('库内最多十篇、联网最多五篇，无 DOI 的多篇联网推荐也能保留', () => {
  const local = Array.from({ length: 10 }, (_, index) => ({ corpus_id: index + 1, title: 'Library ' + index }))
  const external = Array.from({ length: 12 }, (_, index) => ({
    corpus_id: null, origin: 'WEB', title: 'External ' + index,
    doi: '', external_url: 'https://publisher.example/paper/' + index,
  }))
  const items = api.displayRecommendations([...local, ...external], [])
  assert.equal(items.length, 15)
  assert.equal(items.filter(item => item.origin === 'WEB').length, 5)
  assert.equal(items.at(-1).origin, 'WEB')
})
