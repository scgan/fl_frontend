/** 验证 AI 问答以真实 Run 创建时间计时，覆盖返回会话、断线、后台节流与跨时区恢复。 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { pathToFileURL } = require('node:url')
const { execFileSync } = require('node:child_process')
const vue = require('../node_modules/vue')
const ts = require('../node_modules/typescript')
const { compileTemplate } = require('../node_modules/@vue/compiler-sfc')
const { renderToString } = require('../node_modules/@vue/server-renderer')
const helpers = import('../src/research/utils/assistant-progress.js')
const source = fs.readFileSync(path.join(__dirname, '../src/components/ai/AiRunProgress.vue'), 'utf8')
const START = Date.UTC(2026, 9, 28, 4)

/** 创建后端无时区 UTC 时间快照，模拟同一任务的历史与轮询投影。 */
function run(values = {}) {
  return { id: 'run-a', status: 'RUNNING', created_at: '2026-10-28T04:00:00', ...values }
}

/** 装载真实组件脚本与 Vue 响应式；仅替换时钟、定时器和生命周期入口。 */
async function progress(initialRun, initialTime) {
  const clock = { now: initialTime }
  const intervals = new Map(), mounted = [], beforeUnmount = []
  let sequence = 0
  const props = vue.reactive({ run: structuredClone(initialRun) })
  const context = { ...vue, ...await helpers,
    defineProps: () => props,
    onMounted: fn => mounted.push(fn), onBeforeUnmount: fn => beforeUnmount.push(fn),
    Date: class extends Date { static now() { return clock.now } },
    setInterval: fn => { intervals.set(++sequence, fn); return sequence },
    clearInterval: id => intervals.delete(id),
  }
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
    .replace(/^import[^\r\n]*$/gm, '')
  vm.createContext(context)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(script + '\nthis.api = { elapsed, label };', context))
  mounted.forEach(fn => fn())
  return { ...context.api, props, intervals,
    /** 一次唤醒可以跨过长时间后台节流，组件应直接追平真实时刻。 */
    async advance(seconds) {
      clock.now += seconds * 1000
      for (const fn of [...intervals.values()]) fn()
      await vue.nextTick()
    },
    /** 模拟路由卸载，检查刷新定时器确实释放。 */
    unmount() { beforeUnmount.forEach(fn => fn()); scope.stop() },
    /** 编译真实模板并用 Vue 渲染，验证用户看到的秒数及计时显隐。 */
    async html() {
      const compiled = compileTemplate({
        source: source.match(/<template>([\s\S]*?)<\/template>/)[1],
        filename: 'AiRunProgress.vue', id: 'assistant-timer',
      })
      assert.deepEqual(compiled.errors, [])
      const exports = {}
      vm.runInNewContext(ts.transpileModule(compiled.code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText, { exports, require: () => vue })
      return renderToString(vue.createSSRApp({ render: exports.render,
        setup: () => ({ run: props.run, ...context.api }) }))
    },
  }
}

test('离开再进入同一会话继续累计，原 55 秒加离开 90 秒后显示 145 秒', async () => {
  const first = await progress(run(), START + 45_000)
  assert.equal(first.elapsed.value, 45)
  await first.advance(10)
  assert.match(await first.html(), /已用时 55 秒/)
  first.unmount()
  assert.equal(first.intervals.size, 0)
  const restored = await progress(run(), START + 145_000)
  assert.match(await restored.html(), /已用时 145 秒/)
  await restored.advance(1)
  assert.equal(restored.elapsed.value, 146)
  restored.unmount()
})

test('受理记录还没有创建时间时不从零猜测，补读快照后立即显示真实累计用时', async () => {
  const page = await progress(run({ created_at: undefined }), START + 30_000)
  assert.equal(page.elapsed.value, null)
  assert.doesNotMatch(await page.html(), /progress-time/)
  page.props.run.created_at = '2026-10-28 04:00:00'
  await vue.nextTick()
  assert.match(await page.html(), /已用时 30 秒/)
  page.props.run.steps = [{ node_name: 'GenerateAnswer', status: 'RUNNING' }]
  await page.advance(5)
  assert.match(await page.html(), /已用时 35 秒/)
  assert.match(await page.html(), /正在根据文献生成回答/)
  assert.equal(page.intervals.size, 1)
  page.unmount()
})

test('A→B→A 按各自 Run 的创建时间计时，切换和重复快照不留下额外定时器', async () => {
  const page = await progress(run(), START + 60_000)
  page.props.run = run({ id: 'run-b', status: 'PENDING', created_at: '2026-10-28T04:00:50Z' })
  await vue.nextTick()
  assert.equal(page.elapsed.value, 10)
  await page.advance(5)
  page.props.run = run()
  await vue.nextTick()
  assert.equal(page.elapsed.value, 65)
  page.props.run = run()
  await vue.nextTick()
  assert.equal(page.elapsed.value, 65)
  assert.equal(page.intervals.size, 1)
  page.unmount()
})

test('后台节流和断线不重置起点，恢复连接追平后台期间耗时，终态释放定时器', async () => {
  const page = await progress(run(), START + 10_000)
  await page.advance(60)
  assert.equal(page.elapsed.value, 70)
  page.props.run.progressDisconnected = true
  await vue.nextTick()
  assert.equal(page.intervals.size, 0)
  assert.doesNotMatch(await page.html(), /progress-time/)
  await page.advance(90)
  page.props.run.progressDisconnected = false
  await vue.nextTick()
  assert.match(await page.html(), /已用时 160 秒/)
  page.props.run.status = 'SUCCESS'
  page.props.run.finished_at = '2026-10-28T04:02:39'
  await vue.nextTick()
  assert.equal(page.intervals.size, 0)
  assert.equal(page.elapsed.value, 159)
  assert.doesNotMatch(await page.html(), /progress-time|progress-spinner/)
  await page.advance(100)
  assert.equal(page.elapsed.value, 159)
  page.unmount()
})

test('旧 UTC、显式 UTC、北京时间及微秒格式对应同一时刻，浏览器时区不改变结果', async () => {
  const { assistantElapsedSeconds } = await helpers
  for (const created_at of ['2026-10-28T04:00:00', '2026-10-28 04:00:00',
    '2026-10-28T04:00:00Z', '2026-10-28T04:00:00+00:00', '2026-10-28T12:00:00+08:00',
    '2026-10-28T04:00:00.123456'])
    assert.equal(assistantElapsedSeconds(run({ created_at }), START + 60_999), 60)
  const helperUrl = pathToFileURL(path.join(__dirname, '../src/research/utils/assistant-progress.js')).href
  for (const timezone of ['UTC', 'Asia/Shanghai', 'America/New_York']) {
    const code = `import { assistantElapsedSeconds } from ${JSON.stringify(helperUrl)};
      process.stdout.write(String(assistantElapsedSeconds(${JSON.stringify(run())}, ${START + 60_000})))`
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', code], {
      env: { ...process.env, TZ: timezone }, encoding: 'utf8',
    })
    assert.equal(output, '60', timezone)
  }
})

test('异常时间不显示错误秒数，时钟略早于服务端时不出现负数，所有终态使用真实完成时间', async () => {
  const { assistantElapsedSeconds } = await helpers
  for (const created_at of [null, undefined, '', 'invalid', '2026-10-28', '12', Infinity])
    assert.equal(assistantElapsedSeconds(run({ created_at }), START), null)
  assert.equal(assistantElapsedSeconds(run(), START - 1000), 0)
  assert.equal(assistantElapsedSeconds(run(), NaN), null)
  for (const status of ['SUCCESS', 'FAILED', 'CANCELLED']) {
    assert.equal(assistantElapsedSeconds(run({ status, finished_at: '2026-10-28T04:00:42' }), START + 999_000), 42)
    assert.equal(assistantElapsedSeconds(run({ status, finished_at: null }), START + 999_000), null)
  }
})
