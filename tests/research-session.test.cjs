/** 验证研究会话复用 Foreign 令牌和角色限制，旧请求不得注销新身份。 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');

/** 加载实际会话模块并注入隔离存储。 */
function session(role = '2', token = 'first') {
  const data = new Map([['token', token], ['userRole', role]]);
  const redirects = [];
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/research/api/session.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, localStorage: { getItem: k => data.get(k) ?? null, removeItem: k => data.delete(k) }, window: { location: { assign: url => redirects.push(url) } } });
  return { api: exports, data, redirects };
}

test('仅当前选择数据收集者角色且已登录时可进入研究', () => {
  for (const role of ['0', '1', '2', '3', '']) assert.equal(session(role).api.canAccessResearch(), role === '2');
  assert.equal(session('2', '').api.canAccessResearch(), false);
});
test('研究请求实时读取 Foreign 更新后的令牌', () => {
  const s = session();
  s.data.set('token', 'second');
  assert.equal(s.api.getAccessToken(), 'second');
});
test('旧身份请求返回 401 不得清除新身份', () => {
  const s = session(); s.data.set('token', 'second');
  s.api.expireSession('first');
  assert.equal(s.api.getAccessToken(), 'second');
  assert.equal(s.redirects.length, 0);
});
test('当前身份过期同步清除角色与令牌并返回唯一登录页', () => {
  const s = session(); s.api.expireSession('first');
  assert.equal(s.api.getAccessToken(), null);
  assert.equal(s.data.has('userRole'), false);
  assert.deepEqual(s.redirects, ['/login']);
});
