<script setup>
import { ref, nextTick, onUnmounted } from 'vue'
import { getAiTimeline } from '@/api/collector'
import { ElMessage } from 'element-plus'
import { DataLine, Files, Odometer, Refresh, TrendCharts } from '@element-plus/icons-vue'
import * as echarts from 'echarts'

const searchQuery = ref('')
const loading = ref(false)
// 汇总结果：同一关键词下三个维度各一份统计，同屏展示
const result = ref(null)
// 三个维度各自的 ECharts 配置；null 表示该维度没有数据，交给模板里的空状态
const chartOptions = ref({ year: null, category: null, language: null })

// 示例主题：点一下直接开始绘制
const examples = ['双减政策', '人工智能教育', '在线学习', '高校课程改革']

// 不再提供维度下拉：固定按年份 / 类别 / 语言三个维度出三张图
const dimensions = [
  { key: 'year', label: '年份', title: '时序热度趋势', desc: '按出版年份统计文献数量' },
  { key: 'category', label: '类别', title: '类别分布', desc: '按文献所属类别统计' },
  { key: 'language', label: '语言', title: '语言构成', desc: '按文献语种统计' },
]

// 图表容器与实例（保持普通对象，避免把 ECharts 实例变成响应式代理）
const chartEls = { year: null, category: null, language: null }
const chartInstances = { year: null, category: null, language: null }
let resizeObserver = null

/** 模板里用函数式 ref 取容器，避免依赖 document.getElementById。 */
const setChartEl = (key, el) => {
  chartEls[key] = el
}

/** 释放所有图表实例与尺寸监听。 */
const disposeCharts = () => {
  Object.keys(chartInstances).forEach((key) => {
    chartInstances[key]?.dispose()
    chartInstances[key] = null
  })
  resizeObserver?.disconnect()
  resizeObserver = null
}

/** 卡片宽度随窗口/侧栏变化，用 ResizeObserver 比监听 window.resize 更准。 */
const observeResize = () => {
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    Object.values(chartInstances).forEach((instance) => instance?.resize())
  })
  Object.values(chartEls).forEach((el) => el && resizeObserver.observe(el))
}

// ------------------------------------------------------------------
// 数据整形
// ------------------------------------------------------------------

/** 年份：只保留能解析成整数的点，按年份升序（保证是一条时间轴）。 */
const buildYearRows = (rows) =>
  rows
    .map((item) => ({
      year: Number.parseInt(item.year ?? item.label, 10),
      count: Number(item.count) || 0,
    }))
    .filter((item) => Number.isFinite(item.year))
    .sort((a, b) => a.year - b.year)

/** 类别 / 语言：数量降序；超出 maxSlices 的合并成「其他」，避免细条与小扇区挤成一团。 */
const topRows = (rows, maxSlices) => {
  const list = rows
    .map((item) => ({
      name: String(item.label ?? item.name ?? '未知'),
      value: Number(item.count) || 0,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)

  if (list.length <= maxSlices) return list
  const head = list.slice(0, maxSlices - 1)
  const restValue = list.slice(maxSlices - 1).reduce((sum, item) => sum + item.value, 0)
  return [...head, { name: '其他', value: restValue }]
}

const TOOLTIP_BASE = {
  backgroundColor: 'rgba(20, 52, 55, 0.92)',
  borderWidth: 0,
  padding: [6, 10],
  textStyle: { color: '#fff', fontSize: 12 },
}

// ------------------------------------------------------------------
// 三个维度的图表配置：折线（时间轴）/ 横向条形 / 环形
// ------------------------------------------------------------------

/** 年份维度：真正的时序折线，x 轴用年份数值，缺年份不会被平推成等距。 */
const yearOption = (rows) => {
  const points = buildYearRows(rows)
  if (!points.length) return null

  const firstYear = points[0].year
  const lastYear = points[points.length - 1].year

  return {
    grid: { left: 6, right: 18, top: 30, bottom: 4, containLabel: true },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#b9cfd3', type: 'dashed' } },
      formatter: (params) => {
        const point = params?.[0]
        if (!point) return ''
        return `${point.value[0]} 年<br/>${point.value[1]} 篇`
      },
    },
    xAxis: {
      type: 'value',
      // 左右各留一年，首尾点不贴着坐标轴
      min: firstYear - 1,
      max: lastYear + 1,
      scale: true,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e4e8ee' } },
      axisTick: { show: false },
      // 默认会把年份格式化成 2,011，这里强制输出原值
      axisLabel: { color: '#7d8e8c', fontSize: 10, formatter: (value) => `${Math.round(value)}` },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#7d8e8c', fontSize: 10 },
      splitLine: { lineStyle: { color: '#eef2f3', type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: points.map((point) => [point.year, point.count]),
        lineStyle: { width: 2.4, color: '#005767' },
        itemStyle: { color: '#005767', borderColor: '#fff', borderWidth: 1.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 87, 103, 0.3)' },
            { offset: 1, color: 'rgba(0, 87, 103, 0.02)' },
          ]),
        },
        // 数据点少时直接标数值，多了会糊成一片
        label: {
          show: points.length <= 12,
          position: 'top',
          color: '#33595b',
          fontSize: 10,
          formatter: (params) => params.value[1],
        },
        markLine:
          points.length >= 3
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: '#b9cfd3', type: 'dashed', width: 1 },
                label: {
                  formatter: '均值 {c}',
                  color: '#8a9a9d',
                  fontSize: 9,
                  position: 'insideEndTop',
                },
                data: [{ type: 'average' }],
              }
            : undefined,
      },
    ],
  }
}

/** 类别维度：横向条形，类名排在左侧，数量最多的置顶。 */
const categoryOption = (rows) => {
  const list = topRows(rows, 8)
  if (!list.length) return null

  // y 轴 category 的索引从下往上，反转一次让最大值出现在最上面
  const ordered = [...list].reverse()

  return {
    grid: { left: 4, right: 42, top: 12, bottom: 4, containLabel: true },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const item = params?.[0]
        if (!item) return ''
        return `${item.name}<br/>${item.value} 篇`
      },
    },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#7d8e8c', fontSize: 10 },
      splitLine: { lineStyle: { color: '#eef2f3', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: ordered.map((item) => item.name),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e4e8ee' } },
      axisLabel: {
        color: '#33595b',
        fontSize: 11,
        width: 96,
        overflow: 'truncate',
      },
    },
    series: [
      {
        type: 'bar',
        data: ordered.map((item) => item.value),
        barMaxWidth: 26,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#8cc0c8' },
            { offset: 1, color: '#005767' },
          ]),
        },
        label: { show: true, position: 'right', color: '#33595b', fontSize: 10 },
      },
    ],
  }
}

/** 语言维度：环形图，图例在底部兜住语种名，扇区内只标占比。 */
const languageOption = (rows) => {
  const list = topRows(rows, 7)
  if (!list.length) return null

  const total = list.reduce((sum, item) => sum + item.value, 0)
  const palette = ['#005767', '#1f7284', '#3d8b9c', '#63a6b2', '#8bc0c8', '#b3d5da', '#d7e8ea']

  return {
    tooltip: { ...TOOLTIP_BASE, trigger: 'item', formatter: '{b}<br/>{c} 篇（{d}%）' },
    legend: {
      bottom: 0,
      left: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 8,
      type: 'scroll',
      pageIconSize: 9,
      textStyle: { color: '#5b7074', fontSize: 10 },
    },
    series: [
      {
        type: 'pie',
        radius: ['44%', '66%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        minAngle: 4,
        // 占比取整，54% 比 56.76% 好读
        percentPrecision: 0,
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 5 },
        label: {
          show: true,
          position: 'inside',
          color: '#fff',
          fontSize: 10,
          fontWeight: 600,
          formatter: '{d}%',
        },
        labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 5 },
        data: list.map((item, index) => ({
          name: item.name,
          value: item.value,
          // 太小的扇区放不下百分比，直接不标
          label: { show: item.value / total >= 0.08 },
          itemStyle: {
            color: item.name === '其他' ? '#c2ccce' : palette[index % palette.length],
          },
        })),
      },
    ],
  }
}

// ------------------------------------------------------------------
// 绘制流程
// ------------------------------------------------------------------

const renderCharts = () => {
  disposeCharts()
  dimensions.forEach((dim) => {
    const el = chartEls[dim.key]
    const option = chartOptions.value[dim.key]
    if (!el || !option) return
    const instance = echarts.init(el)
    instance.setOption(option)
    chartInstances[dim.key] = instance
  })
  observeResize()
}

/** 三个维度并行请求：任一维度失败不影响另外两个。 */
const fetchByDimension = async (keyword) => {
  const responses = await Promise.all(
    dimensions.map((dim) =>
      getAiTimeline({ keyword, dimension: dim.key }).catch((error) => {
        console.error(`绘制失败（${dim.label}）：`, error)
        return null
      }),
    ),
  )

  const buckets = {}
  let totalCount = 0
  let failed = 0

  responses.forEach((res, index) => {
    const key = dimensions[index].key
    const payload = res?.data?.code === 200 ? res.data.data : null
    if (!payload) {
      failed += 1
      buckets[key] = []
      return
    }
    buckets[key] = Array.isArray(payload.chart_data) ? payload.chart_data : []
    totalCount = Math.max(totalCount, Number(payload.total_count) || 0)
  })

  return { buckets, totalCount, failed }
}

const performSearch = async () => {
  const keyword = searchQuery.value.trim()
  if (!keyword) {
    ElMessage.warning('请先输入研究主题或关键词')
    return
  }

  loading.value = true
  ElMessage.info('正在汇总文献并绘制三个维度…')

  try {
    const { buckets, totalCount, failed } = await fetchByDimension(keyword)

    if (failed === dimensions.length) {
      ElMessage.error('绘制失败，请稍后重试')
      return
    }

    result.value = { keyword, totalCount, ...buckets }
    chartOptions.value = {
      year: yearOption(buckets.year),
      category: categoryOption(buckets.category),
      language: languageOption(buckets.language),
    }

    await nextTick()
    renderCharts()

    if (failed > 0) {
      ElMessage.warning('部分维度没有取到数据')
    } else if (totalCount === 0) {
      ElMessage.warning(`未找到包含「${keyword}」的文献`)
    } else {
      ElMessage.success('绘制成功')
    }
  } catch (error) {
    console.error('绘制失败:', error)
    ElMessage.error('绘制失败，请重试')
  } finally {
    loading.value = false
  }
}

/** 点击示例主题：填入输入框并直接绘制。 */
const applyExample = (text) => {
  searchQuery.value = text
  performSearch()
}

/** 回到输入状态：清空结果并释放图表实例。 */
const resetDraw = () => {
  disposeCharts()
  result.value = null
  chartOptions.value = { year: null, category: null, language: null }
  searchQuery.value = ''
}

onUnmounted(disposeCharts)
</script>

<template>
  <div class="timeline-page">
    <!-- 未生成：图标 + 功能说明 + 输入（页面标题已在顶栏，这里不再重复） -->
    <section v-if="!result" class="timeline-hero">
      <div class="hero-title">
        <div class="hero-icon"><el-icon><DataLine /></el-icon></div>
      </div>
      <ul class="hero-features">
        <li><el-icon><TrendCharts /></el-icon>按年份还原研究热度</li>
        <li><el-icon><Files /></el-icon>自动统计文献分组</li>
        <li><el-icon><Odometer /></el-icon>年份 / 类别 / 语言 三维度同屏呈现</li>
      </ul>

      <div class="hero-input">
        <input
          v-model="searchQuery"
          type="text"
          class="timeline-input"
          placeholder="输入研究主题或关键词，例如：双减政策、人工智能教育、在线学习"
          @keyup.enter="performSearch"
        />
        <button class="draw-btn" :disabled="loading" @click="performSearch">开始绘制</button>
      </div>

      <div class="hero-examples">
        <span>试试这些主题：</span>
        <button
          v-for="item in examples"
          :key="item"
          type="button"
          class="example-chip"
          @click="applyExample(item)"
        >
          {{ item }}
        </button>
      </div>
    </section>

    <!-- 已生成：三张图铺满整块画布，分别对应年份 / 类别 / 语言 -->
    <section v-else class="timeline-result">
      <div class="result-bar">
        <p class="result-summary">
          <strong>{{ result.keyword }}</strong>
          <span>共 {{ result.totalCount }} 篇文献 · 年份 / 类别 / 语言 三维度</span>
        </p>
        <button class="ghost-btn" @click="resetDraw">重新绘制</button>
      </div>

      <div class="charts-wrapper">
        <article v-for="dim in dimensions" :key="dim.key" class="chart-card">
          <header class="chart-head">
            <span class="chart-badge" :class="`is-${dim.key}`">{{ dim.label }}</span>
            <div class="chart-head-text">
              <h3>{{ dim.title }}</h3>
              <p>{{ dim.desc }}</p>
            </div>
          </header>
          <div class="chart-body">
            <div
              :ref="(el) => setChartEl(dim.key, el)"
              v-show="chartOptions[dim.key]"
              class="chart-canvas"
            ></div>
            <p v-if="!chartOptions[dim.key]" class="chart-empty">暂无{{ dim.label }}数据</p>
          </div>
        </article>
      </div>
    </section>

    <!-- 绘制中 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-content">
        <el-icon class="loading-icon"><Refresh /></el-icon>
        <p>正在汇总文献并绘制时间线…</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 与主界面一致的深青主题（页面级 Element 变量，选择器随之统一） */
.timeline-page {
  --el-color-primary: #005767;
  --el-color-primary-light-3: #33798a;
  --el-color-primary-light-5: #66a0ac;
  --el-color-primary-light-7: #99c1c8;
  --el-color-primary-light-8: #cce0e4;
  --el-color-primary-light-9: #eef4f5;
  --el-color-primary-dark-2: #004a56;
  --el-border-radius-base: 8px;
  position: relative;
  display: flex;
  flex-direction: column;
  /* 内容整体在界面中央：图标 / 文字 / 输入框 / 图表卡片都水平垂直居中 */
  justify-content: center;
  /* 顶栏 46px + el-main 上下 padding 24px：铺满内容区，底部不再露出灰色底色 */
  box-sizing: border-box;
  min-height: calc(100vh - 70px);
  padding: 22px 24px 24px;
  border: 1px solid #e8ebef;
  border-radius: 10px;
  background: #fff;
}

/* ---------- 未生成：输入区 ---------- */
.timeline-hero {
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
  text-align: center;
}

/* 图标作为标题组的第一个元素 */
.hero-title {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 18px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #eef4f5;
  color: #005767;
  font-size: 26px;
}

.hero-features {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 22px;
  margin: 0 0 26px;
  padding: 0;
  list-style: none;
  color: #3f6164;
  font-size: 13px;
}

.hero-features li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.hero-features .el-icon {
  color: #005767;
  font-size: 15px;
}

.hero-input {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 740px;
  margin: 0 auto 14px;
}

.timeline-input {
  flex: 1;
  min-width: 0;
  height: 46px;
  padding: 0 16px;
  border: 1px solid #d8e0e3;
  border-radius: 10px;
  background: #fff;
  color: #16292b;
  font-size: 15px;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.timeline-input::placeholder {
  color: #93a3a6;
}

.timeline-input:focus {
  border-color: #005767;
  box-shadow: 0 0 0 3px rgb(0 87 103 / 8%);
}

.draw-btn {
  height: 46px;
  padding: 0 22px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 10px;
  background: #005767;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.15s ease,
    transform 0.1s ease;
}

.draw-btn:hover:not(:disabled) {
  background: #0b6375;
}

.draw-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.draw-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hero-examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #6b7f83;
  font-size: 12px;
}

.example-chip {
  padding: 5px 12px;
  border: 1px solid #dbe5e7;
  border-radius: 999px;
  background: #fff;
  color: #33595b;
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}

.example-chip:hover {
  border-color: #005767;
  background: #f2f8f8;
  color: #005767;
}

/* ---------- 已生成：标题/按钮贴界面左右上角，图表在下方居中 ---------- */
.timeline-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}

.result-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.result-summary {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  margin: 0;
}

.result-summary strong {
  color: #005767;
  font-size: 16px;
  font-weight: 700;
}

.result-summary span {
  color: #7d8e8c;
  font-size: 12px;
}

.ghost-btn {
  height: 32px;
  padding: 0 14px;
  flex: 0 0 auto;
  border: 1px solid #cfe0de;
  border-radius: 8px;
  background: #fff;
  color: #33595b;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}

.ghost-btn:hover {
  border-color: #005767;
  background: #f2f8f8;
  color: #005767;
}

/* 三张图始终一行并排，在剩余空间里水平垂直居中；间距和尺寸都放大一档 */
.charts-wrapper {
  flex: 1;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 1440px;
  min-height: 0;
  margin: 0 auto;
  gap: 24px;
}

.chart-card {
  flex: 1 1 0;
  min-width: 0;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  padding: 12px 12px 6px;
  border: 1px solid #e4e8ee;
  border-radius: 12px;
  background: #fff;
}

.chart-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #eef2f3;
}

/* 维度标签：三种深浅不同的青，一眼区分是哪个维度 */
.chart-badge {
  flex: 0 0 auto;
  padding: 3px 9px;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
}

.chart-badge.is-year {
  background: #005767;
}

.chart-badge.is-category {
  background: #33798a;
}

.chart-badge.is-language {
  background: #66a0ac;
}

.chart-head-text {
  min-width: 0;
}

.chart-head-text h3 {
  margin: 0;
  color: #143437;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}

.chart-head-text p {
  margin: 0;
  overflow: hidden;
  color: #93a3a6;
  font-size: 11px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-body {
  position: relative;
  /* 图表高度跟着屏幕走：小屏不至于挤，大屏尽量铺开，但有上限 */
  height: clamp(340px, 44vh, 460px);
}

.chart-canvas {
  position: absolute;
  inset: 0;
}

.chart-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: #93a3a6;
  font-size: 13px;
}

/* ---------- 绘制中 ---------- */
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: rgb(255 255 255 / 82%);
}

.loading-content {
  text-align: center;
  color: #33595b;
}

.loading-icon {
  color: #005767;
  font-size: 34px;
  animation: rotating 1.6s linear infinite;
}

.loading-content p {
  margin-top: 10px;
  color: #5b7074;
  font-size: 14px;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .timeline-page {
    padding: 18px 14px 20px;
  }

  .hero-input {
    flex-direction: column;
    align-items: stretch;
  }

  .draw-btn {
    width: 100%;
  }

  .result-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  /* 手机才允许换行：一行三张实在放不下时才上下排 */
  .charts-wrapper {
    flex: 0 0 auto;
    flex-wrap: wrap;
  }

  .chart-card {
    flex: 1 1 100%;
    max-width: none;
  }

  .chart-body {
    height: 280px;
  }
}
</style>
