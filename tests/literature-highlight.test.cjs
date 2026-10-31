/** Drive the real reading page against delayed PDF text extraction and canonical snapshots. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');
const vue = require('../node_modules/vue');

function compile(source, mocks) {
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: id => mocks[id] || {}, AbortController,
    window: { devicePixelRatio: 2 }, console });
  return exports;
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function item(str, y = 700) { return { str, width: str.length * 6, transform: [12, 0, 0, 12, 50, y] }; }
function documentFixture(texts, wait) {
  return { numPages: texts.length, destroy() {}, async getPage(number) {
    return {
      async getTextContent() { if (wait) await wait.promise; return { items: texts[number - 1] }; },
      getViewport({ scale }) { return { width: 595 * scale, height: 842 * scale, scale,
        transform: [scale, 0, 0, -scale, 0, 842 * scale] }; },
      render() { return { promise: Promise.resolve(), cancel() {} }; },
    };
  } };
}
function page(documents) {
  const helper = compile(fs.readFileSync(path.join(__dirname, '../src/research/utils/citationHighlight.ts'), 'utf8'), {});
  const rangeHelper = compile(fs.readFileSync(path.join(__dirname, '../src/research/utils/citationRangeHighlight.ts'), 'utf8'), {
    './citationHighlight': helper,
  });
  const source = fs.readFileSync(path.join(__dirname, '../src/views/UploadView/FileManage/LiteratureDetail.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1];
  const transform = (a, b) => [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
  const app = compile(source + '\nexport { selectDocument, openCitation, zoom, documents, pdfViewer, pdfSource, onPdfPageChange, pageHighlights, activeCitation, highlights, highlightMessage, highlightComplete, page, pdfLoading, pdfError, selected };', {
    vue: { ...vue, watch() {}, onMounted() {}, onBeforeUnmount() {} },
    'vue-router': { useRoute: () => ({ query: {} }), useRouter: () => ({}) },
    '@/research/utils/citationHighlight': helper,
    '@/research/utils/citationRangeHighlight': rangeHelper,
    '@/research/utils/pdf-document': { pdfDocumentOptions: data => ({ data }) },
    '@/research/api/literature-files': { fetchReadingFile: async ({ corpus_id }) => ({ data: { arrayBuffer: async () => corpus_id } }) },
    'pdfjs-dist/legacy/build/pdf.js': { GlobalWorkerOptions: {}, Util: { transform },
      getDocument: ({ data }) => ({ promise: Promise.resolve(documents.get(data)), destroy() {} }) },
    'element-plus': { ElMessage: { warning() {}, error() {} } },
  });
  // 模拟连续阅读器的页可见性事件；仍调用真实页面匹配器和坐标投影。
  let scale = 1;
  app.pdfViewer.value = {
    async scrollToPage(number) {
      const sheet = await app.pdfSource.value.getPage(number);
      app.onPdfPageChange(number, sheet.getViewport({ scale }));
    },
    zoomBy(delta) { scale += delta; void this.scrollToPage(app.page.value); },
  };
  app.documents.value = [...documents.keys()].map(id => ({ id, attachments: ['paper.pdf'] }));
  return app;
}

test('完整 chunk 超出短引文的部分及跨页尾部仍高亮，缩放后坐标同步更新', async () => {
  const a = 'A'.repeat(380), b = 'B'.repeat(100);
  const app = page(new Map([[11, documentFixture([[item(a)], [item('HEADER', 800), item(b)]])]]));
  const citation = { citation_index: 1, corpus_id: 11, file_path: 'paper.pdf', page_start: 1,
    page_end: 2, quote_text: a.slice(0, 360), content: a + b };
  await app.openCitation({ citations: [citation] }, 1);
  assert.equal(app.highlightComplete.value, true);
  assert.equal(app.highlights.value.length, 1);
  const viewport = (await app.pdfSource.value.getPage(2)).getViewport({ scale: 1 });
  assert.equal(app.pageHighlights(2, viewport).length, 1); // The following page can render before it becomes current.
  assert.equal(app.pageHighlights(3, viewport).length, 0); // Unrelated page placeholders must not inherit highlights.
  const width = app.highlights.value[0].width;
  app.zoom(0.15); await new Promise(r => setImmediate(r));
  assert.ok(app.highlights.value[0].width > width);
  await app.pdfViewer.value.scrollToPage(2);
  assert.equal(app.page.value, 2);
  assert.equal(app.highlightComplete.value, true);
  assert.equal(app.highlights.value.length, 1); // Excludes the page header.
  assert.match(app.highlightMessage.value, /跨页/);
  await app.selectDocument(11);
  assert.equal(app.highlights.value.length, 0);
  assert.equal(app.activeCitation.value, null);
});

test('旧接口短引文兼容、部分匹配和无匹配均如实显示', async () => {
  const body = 'Actual source paragraph with sufficiently many characters to match.';
  const app = page(new Map([[11, documentFixture([[item(body)]])]]));
  const citation = { citation_index: 1, page_start: 1, page_end: 1, quote_text: body };
  await app.selectDocument(11, 'paper.pdf', 1, true, citation);
  assert.equal(app.highlightComplete.value, true);
  await app.selectDocument(11, 'paper.pdf', 1, true, { ...citation, content: body + ' Missing text is not present.' });
  assert.equal(app.highlightComplete.value, false);
  assert.match(app.highlightMessage.value, /部分匹配/);
  assert.equal(app.highlights.value.length, 1);
  await app.selectDocument(11, 'paper.pdf', 1, true, { ...citation, content: 'Nothing corresponds to these different words.' });
  assert.equal(app.highlights.value.length, 0);
  assert.match(app.highlightMessage.value, /未匹配到/);
  assert.equal(app.pdfError.value, '');
});

test('快速 A→B 切换，旧文本层晚返回不能覆盖新引用高亮', async () => {
  const wait = deferred();
  const app = page(new Map([[11, documentFixture([[item('First original source')]], wait)],
    [12, documentFixture([[item('Second original source')]])]]));
  const old = app.selectDocument(11, 'paper.pdf', 1, true,
    { citation_index: 1, page_start: 1, page_end: 1, content: 'First original source' });
  await new Promise(r => setImmediate(r));
  await app.selectDocument(12, 'paper.pdf', 1, true,
    { citation_index: 2, page_start: 1, page_end: 1, content: 'Second original source' });
  wait.resolve(); await old;
  assert.equal(app.selected.value, 12);
  assert.equal(app.activeCitation.value.citation_index, 2);
  assert.equal(app.highlightComplete.value, true);
  assert.equal(app.highlights.value.length, 1);
  assert.equal(app.pdfLoading.value, false);
});
