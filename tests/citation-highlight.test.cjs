/** 验证真实高亮匹配器的乱序、跨页和部分匹配行为，不依赖网络或模型。 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/research/utils/citationHighlight.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleExports = {};
vm.runInNewContext(code, { exports: moduleExports });
const { matchCitationItems, buildCitationHighlightRects } = moduleExports;

/** 构造 PDF.js 文字项；矩阵使用从上到下的视口坐标。 */
function item(str, x = 0, y = 0) { return { str, transform: [12, 0, 0, 12, x, y], width: str.length * 12 }; }
/** 生成不重复的长正文，避免测试数据意外出现重复锚点。 */
function text(length, start = 0x4e00) { return Array.from({ length }, (_, i) => String.fromCharCode(start + i)).join(''); }
/** 返回指定页命中的原始文字项下标。 */
function indexes(result, page) { return Array.from(result.indexesByPage.get(page) ?? []).sort((a, b) => a - b); }

test('中文 OCR 把百分比、天数移到行尾时，按真实文本行恢复，数字不拼成另一数字', () => {
  const words = ['39.6%', '的班主任每周有', '3~4', '天参与，', '28.6%', '的班主任'];
  let x = 0;
  const items = words.map(str => { const value = item(str, x, 100); x += value.width; return value; });
  const result = matchCitationItems([{ pageNumber: 5, items }], '的班主任每周有 天参与， 的班主任\n39.6% 3~4 28.6%');
  assert.equal(result.matchedCharacterCount, result.targetCharacterCount);
  assert.deepEqual(indexes(result, 5), [0, 1, 2, 3, 4, 5]);
});

test('数字只能补到相邻已定位的同栏正文，不能借用另一栏相同数字', () => {
  const body = '这是一段已经定位的班主任课后服务调查研究正文';
  const items = [item('53.5%', 0, 100), item(body, 350, 100)];
  const result = matchCitationItems([{ pageNumber: 1, items }], body + '\n53.5%');
  assert.deepEqual(indexes(result, 1), [1]);
  assert.ok(result.matchedCharacterCount < result.targetCharacterCount);
});

test('独立数字行带研修斜杠时仍按真实百分比匹配，不把斜杠当数字', () => {
  const words = ['有发生变化；', '36', '.', '1', '%', '的班主任表示参加班主任研修', '/'];
  let x = 0;
  const items = words.map(str => { const value = item(str, x, 100); x += value.width; return value; });
  const result = matchCitationItems([{ pageNumber: 6, items }], '有发生变化； 的班主任表示参加班主任研修\n36.1% /');
  assert.equal(result.matchedCharacterCount, result.targetCharacterCount);
  assert.ok(indexes(result, 6).includes(1));
  assert.ok(indexes(result, 6).includes(3));
});

test('字体上升下降范围覆盖基线下方，45% 缩放和旋转仍同步', () => {
  const source = { ...item('正文', 50, 100), ascent: .89, descent: -.22 };
  const box = buildCitationHighlightRects([source], new Set([0]), { scale: 1, transform: [1, 0, 0, -1, 0, 800] })[0];
  assert.ok(Math.abs(box.top - (700 - 12 * .89)) < 1e-8);
  assert.ok(Math.abs(box.top + box.height - (700 + 12 * .22)) < 1e-8);
  const small = buildCitationHighlightRects([source], new Set([0]), { scale: .45, transform: [.45, 0, 0, -.45, 0, 360] })[0];
  assert.ok(Math.abs(small.top - box.top * .45) < 1e-8);
  assert.ok(Math.abs(small.height - box.height * .45) < 1e-8);
  const rotated = buildCitationHighlightRects([source], new Set([0]), { scale: 1, transform: [0, 1, 1, 0, 0, 0] })[0];
  assert.ok(Math.abs(rotated.left - (100 - 12 * .22)) < 1e-8);
  assert.ok(Math.abs(rotated.width - 12 * 1.11) < 1e-8);
});

test('引号括号和句末标点随正文连起来，未引用的相邻文字仍不高亮', () => {
  const items = ['“', '引用正文', '”', '。', '其他正文'].map((str, i, list) =>
    item(str, list.slice(0, i).join('').length * 12, 100));
  const matched = new Set([1]);
  const boxes = buildCitationHighlightRects(items, matched, { scale: 1, transform: [1, 0, 0, -1, 0, 800] });
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].left, 0);
  assert.equal(boxes[0].width, '“引用正文”。'.length * 12);
  assert.deepEqual([...matched], [1]);
});

test('同一行的标点字框发生重叠时合并成一个框，避免边框穿过文字', () => {
  const items = [item('前文', 0, 100), item('。', 24, 100), item('“', 30, 100), item('后文', 42, 100)];
  const boxes = buildCitationHighlightRects(items, new Set([0, 3]), { scale: 1, transform: [1, 0, 0, -1, 0, 800] });
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].width, 66);
});

test('同一行词间空白和短缺口连起来，换行保留各自文字宽度及分栏', () => {
  const items = [item('政策', 0, 100), item('，', 24, 100), item('研究', 36, 100),
    item('缺口', 60, 100), item('正文', 84, 100), item('右栏', 350, 100), item('下一行', 0, 120)];
  const boxes = buildCitationHighlightRects(items, new Set([0, 2, 4, 5, 6]), { scale: 1, transform: [1, 0, 0, -1, 0, 800] });
  assert.equal(boxes.length, 3);
  assert.ok(boxes.some(box => box.left === 0 && box.width === 108));
  assert.ok(boxes.every(box => box.width < 150));
});

test('连续多行的窄栏间隙不能被当成词间空白连起来', () => {
  const items = [100, 120, 140, 160].flatMap(y => [item('左栏正文', 0, y), item('右栏正文', 66, y)]);
  const boxes = buildCitationHighlightRects(items, new Set(items.map((_, i) => i)), { scale: 1, transform: [1, 0, 0, -1, 0, 800] });
  assert.equal(boxes.length, 8);
  assert.ok(boxes.every(box => box.width === 48));
});

test('连续三行高亮填满行距，缩放后仍相接且不扩大首尾范围', () => {
  const items = [item('第一行完整引用', 0, 100), item('第二行完整引用', 0, 120), item('末行', 0, 140)];
  for (const scale of [1, .45, 1.5]) {
    const viewport = { scale, transform: [scale, 0, 0, -scale, 0, 800 * scale] };
    const matched = new Set([0, 1, 2]);
    const boxes = buildCitationHighlightRects(items, matched, viewport).sort((a, b) => a.top - b.top);
    assert.equal(boxes.length, 3);
    assert.ok(Math.abs(boxes[0].top - 648 * scale) < 1e-8);
    assert.ok(Math.abs(boxes[2].top + boxes[2].height - 700 * scale) < 1e-8);
    for (let i = 1; i < boxes.length; i++) {
      assert.ok(boxes[i - 1].top + boxes[i - 1].height >= boxes[i].top);
    }
    assert.deepEqual([...matched], [0, 1, 2]);
  }
});

test('连接行距不能覆盖夹在中间的未引用正文', () => {
  const items = [item('引用开始', 0, 100), item('未引用正文', 0, 114), item('引用结尾', 0, 128)];
  const viewport = { scale: 1, transform: [1, 0, 0, -1, 0, 800] };
  const boxes = buildCitationHighlightRects(items, new Set([0, 2]), viewport).sort((a, b) => a.top - b.top);
  assert.equal(boxes.length, 2);
  assert.ok(boxes[0].top + boxes[0].height < boxes[1].top);
  assert.ok(boxes.every(box => box.height === 12));
});

test('参考文献的悬挂缩进和短行填成整块，首尾无其他正文时也填满排版空白', () => {
  const items = [
    { ...item('Li reference starts', 0, 100), width: 240 },
    { ...item('short journal', 24, 114), width: 90 },
    { ...item('Meinhof reference', 0, 128), width: 240 },
    { ...item('short publisher', 24, 142), width: 120 },
    { ...item('Mignolo final', 0, 156), width: 180 },
  ];
  for (const scale of [1, .45, 1.5]) {
    const boxes = buildCitationHighlightRects(items, new Set([0, 1, 2, 3, 4]),
      { scale, transform: [scale, 0, 0, scale, 0, 0] }).sort((a, b) => a.top - b.top);
    assert.equal(boxes[0].width, 240 * scale);
    assert.equal(boxes.at(-1).width, 240 * scale);
    // 不只检查上下边相接：缩进行与短行的整个内部带宽都应有背景。
    for (const row of boxes.slice(1, -1)) {
      assert.equal(row.left, 0);
      assert.equal(row.width, 240 * scale);
    }
  }
});

test('整块填色仍保留首尾文字项的字符级裁剪，不染到相邻原文', () => {
  const items = [item('prefixSTART', 0, 100), { ...item('quoted middle', 0, 114), width: 240 },
    item('ENDsuffix', 0, 128)];
  const ranges = new Map([[0, { start: 6, end: 11 }], [1, { start: 0, end: 13 }],
    [2, { start: 0, end: 3 }]]);
  const boxes = buildCitationHighlightRects(items, new Set([0, 1, 2]),
    { scale: 1, transform: [1, 0, 0, 1, 0, 0] }, ranges).sort((a, b) => a.top - b.top);
  assert.equal(boxes[0].left, 72);
  assert.equal(boxes[1].left, 0);
  assert.equal(boxes[1].width, 240);
  assert.equal(boxes.at(-1).left + boxes.at(-1).width, 36);
});

test('紧密重叠的字框也归入同一引用块，内部空白不受字体升降部差异影响', () => {
  const items = [
    { ...item('first reference', 0, 100), width: 240 },
    { ...item('short italic', 24, 111), width: 90 },
    { ...item('next reference', 0, 122), width: 240 },
  ];
  const boxes = buildCitationHighlightRects(items, new Set([0, 1, 2]),
    { scale: 1, transform: [1, 0, 0, 1, 0, 0] }).sort((a, b) => a.top - b.top);
  assert.equal(boxes[1].left, 0);
  assert.equal(boxes[1].width, 240);
});

test('填满连续块时仍不能染到内部行两端真实存在的未引用文字', () => {
  const items = [
    { ...item('first', 0, 100), width: 240 },
    { ...item('unquoted prefix', 0, 114), width: 50 },
    { ...item('quoted middle', 60, 114), width: 100 },
    { ...item('unquoted suffix', 170, 114), width: 70 },
    { ...item('last', 0, 128), width: 240 },
  ];
  const boxes = buildCitationHighlightRects(items, new Set([0, 2, 4]),
    { scale: 1, transform: [1, 0, 0, 1, 0, 0] }).sort((a, b) => a.top - b.top);
  assert.ok(boxes[1].left >= 50);
  assert.ok(boxes[1].left + boxes[1].width <= 170);
});

test('参考文献短行尾部不能误识别为栏间隙，真实双栏仍保持分离', () => {
  const items = Array.from({ length: 8 }, (_, row) => [
    { ...item('left reference', row % 3 ? 24 : 0, 100 + row * 14), width: row % 3 ? 100 : 200 },
    { ...item('unquoted right column', 260, 100 + row * 14), width: 200 },
  ]).flat();
  const boxes = buildCitationHighlightRects(items, new Set(items.map((_, i) => i).filter(i => i % 2 === 0)),
    { scale: 1, transform: [1, 0, 0, 1, 0, 0] }).sort((a, b) => a.top - b.top);
  for (const row of boxes.slice(1, -1)) {
    assert.equal(row.left, 0);
    assert.equal(row.width, 200);
  }
  assert.ok(boxes.every(row => row.left + row.width <= 200));
});

test('左右栏分别连续填充行距，栏间空白仍保持清晰', () => {
  const items = [100, 120, 140].flatMap(y => [item('左栏正文', 0, y), item('右栏正文', 66, y)]);
  const boxes = buildCitationHighlightRects(items, new Set(items.map((_, i) => i)),
    { scale: 1, transform: [1, 0, 0, -1, 0, 800] });
  assert.equal(boxes.length, 6);
  assert.ok(boxes.every(box => box.width === 48));
  for (const left of [0, 66]) {
    const column = boxes.filter(box => box.left === left).sort((a, b) => a.top - b.top);
    for (let i = 1; i < column.length; i++) {
      assert.ok(column[i - 1].top + column[i - 1].height >= column[i].top);
    }
  }
});

test('连接视觉短间隔不会更改原文字符匹配统计，大段无关正文仍留空', () => {
  const body = '已经确认引用的真实原文内容足够长';
  const items = [item(body, 0, 100), item('未引用的整段无关正文', body.length * 12, 100), item('结尾', (body.length + 11) * 12, 100)];
  const result = matchCitationItems([{ pageNumber: 1, items }], body);
  const matched = result.matchedCharacterCount;
  const boxes = buildCitationHighlightRects(items, new Set([0, 2]), { scale: 1, transform: [1, 0, 0, -1, 0, 800] });
  assert.equal(boxes.length, 2);
  assert.equal(result.matchedCharacterCount, matched);
});

test('45% 缩放使用实际字体高度，90 度旋转时矩形仍覆盖真实文字方向', () => {
  const items = [item('正文', 50, 100)];
  const small = buildCitationHighlightRects(items, new Set([0]), { scale: .45, transform: [.45, 0, 0, -.45, 0, 800] });
  assert.ok(Math.abs(small[0].height - 12 * .45) < 1e-8);
  assert.ok(Math.abs(small[0].width - 24 * .45) < 1e-8);
  const rotated = buildCitationHighlightRects(items, new Set([0]), { scale: 1, transform: [0, 1, 1, 0, 0, 0] });
  assert.equal(rotated[0].width, 12);
  assert.equal(rotated[0].height, 24);
});

test('复现 24/381：DOI 在内容流末尾，证据却以 DOI 开头，正文仍应完整定位', () => {
  const doi = 'DOI:10.20247/j.issn1671-1106.2021.06.001';
  const body = text(381 - doi.replace(/[^a-z0-9]/gi, '').length);
  const result = matchCitationItems([{ pageNumber: 1, items: [item(body, 0, 100), item(doi, 0, 200)] }], doi + body);
  assert.equal(result.targetCharacterCount, 381);
  assert.equal(result.matchedCharacterCount, 381);
  assert.deepEqual(indexes(result, 1), [0, 1]);
});

test('页面文字项倒序且每项不足 24 字符，按位置恢复连续正文', () => {
  const body = text(90);
  const items = [item(body.slice(60), 240, 100), item(body.slice(30, 60), 120, 100), item(body.slice(0, 30), 0, 100)];
  // 将每个文字项进一步拆为单字，模拟中文 PDF 的细粒度文本层。
  const glyphs = items.flatMap((part) => [...part.str].map((str, i) => item(str, part.transform[4] + i * 3, 100))).reverse();
  const result = matchCitationItems([{ pageNumber: 1, items: glyphs }], body);
  assert.equal(result.matchedCharacterCount, 90);
  assert.equal(indexes(result, 1).length, 90);
});

test('跨页正文包含页眉插入和换行，按原始文字项映射且不高亮页眉', () => {
  const a = text(57), b = text(65, 0x5000);
  const result = matchCitationItems([
    { pageNumber: 2, items: [item(a)] },
    { pageNumber: 3, items: [item('额外页眉', 0, 0), item(b, 0, 100)] },
  ], a + '\n' + b);
  assert.equal(result.matchedCharacterCount, 122);
  assert.deepEqual(indexes(result, 2), [0]);
  assert.deepEqual(indexes(result, 3), [1]);
});

test('双栏内容流与视觉顺序不同，保留内容流完整匹配', () => {
  const a = text(30), b = text(30, 0x5100), c = text(30, 0x5200), d = text(30, 0x5300);
  const result = matchCitationItems([{ pageNumber: 1, items: [item(a, 0, 0), item(b, 0, 30), item(c, 400, 0), item(d, 400, 30)] }], a + b + c + d);
  assert.equal(result.matchedCharacterCount, 120);
});

test('连续锚点后不足 24 字符的尾部保留，缺失内容不制造高亮', () => {
  const a = text(35), absent = text(30, 0x6000);
  const result = matchCitationItems([{ pageNumber: 1, items: [item(a)] }], absent + a + absent);
  assert.equal(result.matchedCharacterCount, 35);
  assert.equal(result.targetCharacterCount, 95);
});

test('重复证据不能重复使用 PDF 同一段来虚增覆盖率', () => {
  const a = text(35);
  const result = matchCitationItems([{ pageNumber: 1, items: [item(a)] }], a + a);
  assert.equal(result.matchedCharacterCount, 35);
  assert.equal(result.targetCharacterCount, 70);
});

test('没有长锚点时不因零散相同字符制造高亮', () => {
  const result = matchCitationItems([{ pageNumber: 1, items: [item('共同的短标题')] }], '共同的短标题' + text(80));
  assert.equal(result.matchedCharacterCount, 0);
  assert.equal(result.indexesByPage.size, 0);
});

test('短证据仍可整段精确匹配；空正文不命中', () => {
  const pages = [{ pageNumber: 1, items: [item('ＡＢＣ，中文。')] }];
  assert.equal(matchCitationItems(pages, 'abc中文').matchedCharacterCount, 5);
  assert.equal(matchCitationItems(pages, '').indexesByPage.size, 0);
});


test('双栏正文中的小字号上标归回正文行，不再漏掉不足24字的前半句', () => {
  const a=text(30), b=text(30,0x5100), c=text(30,0x5200), d=text(30,0x5300);
  const short='联网教育进入智能教育发展的高级阶段';
  const marker={str:'[1]',transform:[7,0,0,7,short.length*12+1,116],width:7};
  const items=[item(a,0,100),item(short,0,120),marker,item('利用人',short.length*12+10,120),
    item(b,0,140),item(c,500,100),item(d,500,120)];
  const result=matchCitationItems([{pageNumber:1,items}],a+c+short+'[1]利用人'+d+b);
  assert.equal(result.matchedCharacterCount,result.targetCharacterCount);
  assert.ok(indexes(result,1).includes(1));
  assert.ok(indexes(result,1).includes(2));
  assert.equal(marker.transform[5],116); // 分行不改动实际绘制坐标。
});

test('独立数字行和远处小字不能被当作正文上标并入', () => {
  const a=text(30), b=text(30,0x5100);
  const items=[item(a,0,100),item('123',0,112),item(b,0,124),
    {str:'[2]',transform:[7,0,0,7,1000,120],width:7}];
  const result=matchCitationItems([{pageNumber:1,items}],a+b);
  assert.equal(result.matchedCharacterCount,60);
  assert.deepEqual(indexes(result,1),[0,2]);
});
