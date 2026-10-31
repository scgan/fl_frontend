/** 回归智鉴矩阵的字段级引用：整行有来源不代表每个单元格都有可发布结论。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../node_modules/typescript')

const exportsObject = {}
const source = fs.readFileSync(path.join(__dirname, '../src/research/utils/comparison-text.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(compiled, { exports: exportsObject })
const { matrixCellText, formatCitedText } = exportsObject

test('只有一侧有来源时，不将整行引用附在证据不足的差异和共同点后', () => {
  const row = { object_a: '证据不足', object_b: '高等教育的教学场景[1]。', similarity: '证据不足', difference: '证据不足', object_a_citation_ids: [], object_b_citation_ids: [1, 2], shared_citation_ids: [], citation_ids: [1, 2] }
  assert.equal(matrixCellText(row, 'object_a', [1, 2]), '证据不足')
  assert.equal(matrixCellText(row, 'similarity', [1, 2]), '证据不足')
  assert.equal(matrixCellText(row, 'difference', [1, 2]), '证据不足')
  assert.equal(matrixCellText(row, 'object_b', [1, 2]), '高等教育的教学场景[1]。 [2]')
})

test('差异保留自己的逐句引用，不补入仅支持其他单元格的编号', () => {
  const row = { object_a: '基础教育[7][8]', object_b: '高等教育[2][3][4]', similarity: '证据不足', difference: '高等教育侧重效率[2][4]，基础教育侧重素养[7][8]。', object_a_citation_ids: [7, 8], object_b_citation_ids: [2, 3, 4], shared_citation_ids: [], citation_ids: [7, 8, 2, 3, 4] }
  assert.equal(matrixCellText(row, 'difference', [2, 3, 4, 7, 8]), row.difference)
  assert.equal(matrixCellText(row, 'difference', [2, 3, 4, 7, 8]).includes('[3]'), false)
})

test('旧的纯证据不足占位即使带编号也不显示引用，不吞掉有实质说明的正文', () => {
  assert.equal(formatCitedText('证据不足 [6]。', [6], [6]), '证据不足')
  assert.equal(formatCitedText('当前证据不足以比较，但来源讨论了基础教育[6]。', [], [6]), '当前证据不足以比较，但来源讨论了基础教育[6]。')
})

test('不重复已有引用、不补未发布编号，也不猜测旧矩阵的整行来源归属', () => {
  assert.equal(formatCitedText('明确结论[1]', [1, 1, 2, 99], [1, 2]), '明确结论[1] [2]')
  assert.equal(matrixCellText({ object_a: '旧结论[1]', citation_ids: [1, 2] }, 'object_a', [1, 2]), '旧结论[1]')
})
