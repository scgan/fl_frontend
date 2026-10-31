/** 验证实际 Markdown 渲染器的标题层级、历史换行修复与逐消息引用映射。 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');
const vue = require('../node_modules/vue');
const MarkdownIt = require('../node_modules/markdown-it');

function renderer(content, indices) {
  const props = vue.reactive({ content, citationIndices: indices });
  const source = fs.readFileSync(path.join(__dirname, '../src/research/components/common/ResearchMarkdown.vue'), 'utf8')
    .split('<script setup lang="ts">')[1].split('</script>')[0] + '\nexport { renderedContent };';
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  // Sanitization itself is covered by real-browser QA; inspect parser output here.
  vm.runInNewContext(code, { exports, require: id => ({ vue, 'markdown-it': MarkdownIt,
    dompurify: { sanitize: value => value } })[id], defineProps: () => props, defineEmits: () => () => {} });
  return { props, html: () => exports.renderedContent.value };
}

test('相邻及重复引用可点击；未知编号、代码、转义和 Markdown 链接保持原样', () => {
  const app = renderer('结论[1][2]，重复[1]，未知[99]。`[1]` \\[1]\n\n```text\n[2]\n```\n\n[1](https://example.com)\n\n[2][ref]\n\n[ref]: https://example.com/ref', [1, 2]);
  const html = app.html();
  assert.equal((html.match(/class="research-citation"/g) || []).length, 3);
  assert.match(html, /<code>\[1\]<\/code>/);
  assert.match(html, /<a href="https:\/\/example.com">1<\/a>/);
  assert.match(html, /<a href="https:\/\/example.com\/ref">2<\/a>/);
  assert.ok(!html.includes('data-citation-index="99"'));
});

test('没有引用映射的旧消息及其他研究模块保持普通编号，切换消息后更新映射', () => {
  const app = renderer('结论[1][2]');
  assert.ok(!app.html().includes('research-citation'));
  app.props.citationIndices = [2];
  assert.ok(app.html().includes('data-citation-index="2"'));
  assert.ok(!app.html().includes('data-citation-index="1"'));
  app.props.citationIndices = [1];
  assert.ok(!app.html().includes('data-citation-index="2"'));
});

test('原始 HTML 不能伪造引用按钮', () => {
  const app = renderer('<button data-citation-index="1" onclick="alert(1)">伪造</button>', [1]);
  assert.ok(!app.html().includes('<button'));
  assert.match(app.html(), /&lt;button/);
});

test('合法多级标题保留层级，正文黏连标题仍能修复且不产生空标题', () => {
  const html = renderer('## 政策背景\n\n正文内容。\n\n### 1.1 学校实践\n\n小节正文。\n\n#### 具体观察\n\n观察结论。## 2. 研究方法\n\n方法正文。').html();
  assert.match(html, /<h2>政策背景<\/h2>/);
  assert.match(html, /<h3>1\.1 学校实践<\/h3>/);
  assert.match(html, /<h4>具体观察<\/h4>/);
  assert.match(html, /<p>观察结论。<\/p>\s*<h2>2\. 研究方法<\/h2>/);
  assert.doesNotMatch(html, /<h[1-6]>\s*<\/h[1-6]>/);
});
