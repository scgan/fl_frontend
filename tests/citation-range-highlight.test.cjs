const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');
function load(name, mocks = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/research/utils', name + '.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { exports, require: id => mocks[id] });
  return exports;
}
const base = load('citationHighlight');
const { locateCitationHighlights: locate } = load('citationRangeHighlight', { './citationHighlight': base });
const text = (length, start = 0x4e00) => Array.from({ length }, (_, i) => String.fromCharCode(start + i)).join('');
const item = (str, x = 0, y = 100, height = 12) => ({ str, width: str.length * height,
  transform: [height, 0, 0, height, x, y] });
const page = items => ({ pageNumber: 1, width: 800, height: 800, items });
const covered = (result, number, index) => result.rangesByPage.get(number)?.get(index);

test('中间错词和漏字仍连续高亮，前后无关段落保持原样，统计不伪造成完整匹配', () => {
  const a = text(30), b = text(30, 0x5100), c = text(30, 0x5200);
  const pages = [page([item('不属于引用的上一段', 0, 70), item(a), item('替换错词', 0, 120),
    item(b, 0, 140), item(c, 0, 160), item('下一段也不属于引用', 0, 180)])];
  const source = a + '原来的文字' + b + c, result = locate(pages, source);
  assert.equal(result.rangeLocated, true);
  assert.equal(result.approximate, true);
  assert.ok(covered(result, 1, 2));
  assert.equal(covered(result, 1, 0), undefined);
  assert.equal(covered(result, 1, 5), undefined);
  assert.ok(result.matchedCharacterCount < result.targetCharacterCount);
});

test('首尾都落在同一个文字项内部时裁剪，不把整句前后文涂亮', () => {
  const body = text(40), value = '前文' + body + '后文';
  const result = locate([page([item(value)])], body);
  assert.equal(result.rangeLocated, true);
  assert.deepEqual({ ...covered(result, 1, 0) }, { start: 2, end: 42 });
  const boxes = base.buildCitationHighlightRects([item(value, 0, 700)], result.indexesByPage.get(1),
    { scale: .5, transform: [.5, 0, 0, -.5, 0, 400] }, result.rangesByPage.get(1));
  assert.equal(boxes[0].left, 12);
  assert.equal(boxes[0].width, 240);
});

test('双栏按左栏向下再右栏向下连接，不涂左栏前文和右栏后文，不跨栏合并', () => {
  const words = Array.from({ length: 8 }, (_, i) => text(18, 0x4e00 + 40 * i));
  const items = [0, 1, 2, 3].flatMap(i => [item(words[i], 0, 100 + i * 24), item(words[i + 4], 450, 100 + i * 24)]);
  const body = words[2].slice(5) + words[3] + words[4] + words[5].slice(0, 9);
  const result = locate([page(items)], body);
  assert.equal(result.rangeLocated, true);
  assert.equal(result.approximate, false);
  assert.deepEqual([...result.indexesByPage.get(1)].sort((a,b) => a-b), [1, 3, 4, 6]);
  assert.equal(covered(result, 1, 4).start, 5);
  assert.equal(covered(result, 1, 3).end, 9);
  const boxes = base.buildCitationHighlightRects(items, result.indexesByPage.get(1),
    { scale: 1, transform: [1, 0, 0, -1, 0, 800] }, result.rangesByPage.get(1));
  assert.equal(boxes.length, 4);
  assert.ok(boxes.every(box => box.width <= 216));
});

test('跨页范围跳过页眉页脚，并在最后一行 chunk 末尾停止', () => {
  const a = text(40), b = text(40, 0x5100);
  const pages = [page([item('HEADER', 0, 20, 8), item(a), item('1', 0, 780, 8)]),
    { ...page([item('HEADER', 0, 20, 8), item(b + '下一段', 0, 100), item('2', 0, 780, 8)]), pageNumber: 2 }];
  const result = locate(pages, a + b);
  assert.equal(result.rangeLocated, true);
  assert.equal(result.approximate, false);
  assert.deepEqual([...result.indexesByPage.get(1)], [1]);
  assert.deepEqual([...result.indexesByPage.get(2)], [1]);
  assert.equal(covered(result, 2, 1).end, b.length);
});

test('大字号孤立页眉也不进入跨页引用的连续范围', () => {
  const a = text(40), b = text(40, 0x5100);
  const pages = [page([item('first.pdf - page 1', 0, 60, 16), item(a, 0, 140)]),
    { ...page([item('first.pdf - page 2', 0, 60, 16), item(b, 0, 140)]), pageNumber: 2 }];
  const result = locate(pages, a + b);
  assert.equal(result.rangeLocated, true);
  assert.equal(result.approximate, false);
  assert.equal(covered(result, 1, 0), undefined);
  assert.equal(covered(result, 2, 0), undefined);
});

test('首尾各有少量识别差异时有界定位，不能扩成整页', () => {
  const body = text(80);
  const result = locate([page([item('甲乙' + body + '丙'), item('不相关下一段', 0, 140)])], '丁戊' + body + '己');
  assert.equal(result.rangeLocated, true);
  assert.equal(result.approximate, true);
  assert.equal(covered(result, 1, 0).start, 0);
  assert.equal(covered(result, 1, 0).end, 83);
  assert.equal(covered(result, 1, 1), undefined);
});

test('重复候选无法消歧时不把两段连接起来；首尾缺失过多时保留部分定位', () => {
  const body = text(50);
  const repeated = locate([page([item(body), item('分隔内容', 0, 130), item(body, 0, 160)])], body);
  assert.equal(repeated.rangeLocated, false);
  const missing = locate([page([item(body)])], text(40, 0x6000) + body);
  assert.equal(missing.rangeLocated, false);
});

test('首尾引号和句号取自 chunk 自身，不吞相邻标点或下一句', () => {
  const body = text(40), parts = ['上一句。', '“', body, '”', '。', '下一句。'];
  let x = 0;
  const items = parts.map(str => { const value = item(str, x); x += value.width; return value; });
  const result = locate([page(items)], '“' + body + '”。');
  assert.equal(result.rangeLocated, true);
  assert.deepEqual([...result.indexesByPage.get(1)], [1, 2, 3, 4]);
});
