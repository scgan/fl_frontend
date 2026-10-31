<!-- 首页数据看板（真实数据）：统一青蓝色系、六宫格布局，主图为自动轮动的数据库条形图。 -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts'


/* ---------------- 统一青蓝色系（单色相，靠明度区分） ---------------- */
const TEAL = ['#0f8f8a', '#22a49d', '#3fb8ae', '#63c9bf', '#8bd8d0', '#b4e5df', '#d6f0ec']
const NEUTRAL = '#a8bcc0'

const TOTAL = 186437

const DATABASES = [
  {
    name: '中国教育思想文献国际传播数据库',
    count: 62148,
    hue: '#1f9c90',
    children: [
      {
        name: '中国教育思想文献数据库（汉语）',
        count: 31074,
        children: [
          { name: '中国古代教育思想文献', count: 8076 },
          { name: '中国近现代教育思想文献', count: 12005 },
          { name: '中国当代教育思想文献', count: 10993 },
        ],
      },
      {
        name: '中国教育思想国际传播多语种数据库（汉语、英语、俄语、日语、法语、韩语、西语）',
        count: 18531,
        children: [
          { name: '中国古代教育思想国际传播多语种数据库（翻译、介绍、评价）', count: 6867 },
          { name: '中国近现代教育思想国际传播多语种数据库', count: 5676 },
          { name: '中国当代教育思想国际传播多语种数据库', count: 2001 },
        ],
      },
      {
        name: '国外教育文献数据库（汉语、英语、俄语、日语、法语、朝语、西班牙语）',
        count: 4535,
        children: [
          { name: '主要英语国家教育文献', count: 1540 },
          { name: '俄罗斯及俄语国家教育文献', count: 2212 },
          { name: '日韩法西等国教育文献', count: 1776 },
        ],
      },
      {
        name: '中国教育思想多语种平行语料库（汉语与英语、俄语、日语、法语、朝语、西班牙语的平行语对）',
        count: 8017,
        children: [
          { name: '古代思想多语种平行语对', count: 6261 },
          { name: '近现代思想多语种平行语对', count: 4732 },
        ],
      },
    ],
  },
  {
    name: '中国教育政策国际传播多语种数据库',
    count: 49712,
    hue: '#3d85cf',
    children: [
      {
        name: '中国教育政策国际传播多语种数据库（汉语、英语、俄语、日语、法语、朝语、西班牙语）',
        count: 29304,
        children: [
          { name: '高等教育政策多语种文献', count: 11668 },
          { name: '基础教育政策多语种文献', count: 8740 },
          { name: '职业教育政策多语种文献', count: 4729 },
        ],
      },
      {
        name: '国外教育政策文献数据库（主要英语国家、俄罗斯及其他俄语国家、日、韩、法、西班牙、拉美、其他一带一路沿线国家和地区）',
        count: 19166,
        children: [
          { name: '主要英语国家教育政策', count: 5409 },
          { name: '俄罗斯及其他俄语国家教育政策', count: 1553 },
          { name: '日韩法西及拉美教育政策', count: 1716 },
          { name: '一带一路沿线国家和地区教育政策', count: 1634 },
        ],
      },
      {
        name: '中国教育政策多语种平行语料库（2025年）（汉语与英语、俄语、日语、法语、朝语、西班牙语的平行语对）',
        count: 6765,
        children: [
          { name: '政策文本汉英平行语对', count: 3108 },
          { name: '政策文本汉俄平行语对', count: 2699 },
          { name: '政策文本多语并行语对', count: 2933 },
        ],
      },
    ],
  },
  {
    name: '中国外语教育数据库',
    count: 74577,
    hue: '#e8963c',
    children: [
      {
        name: '中国外语教育数据库（汉语）',
        count: 53824,
        children: [
          { name: '中国外语教育理论文献库', count: 10891 },
          { name: '中国外语教育政策文献库', count: 9862 },
          { name: '中国外语教育实践数据库（教学模式、探索创新）', count: 6397 },
          { name: '中国外语教育事件数据库（文字、图片、音视频）', count: 6565 },
          { name: '中国外语教育人物数据库（知名学者、名师等访谈、生平、成果等）', count: 6067 },
        ],
      },
      {
        name: '国外外语教育数据库（汉语、英语、俄语、日语、法语、朝鲜语、西语）',
        count: 29873,
        children: [
          { name: '国外外语教育理论文献库', count: 4922 },
          { name: '国外外语教育政策文献库', count: 1092 },
          { name: '国外外语教育实践数据库', count: 1106 },
          { name: '国外外语教育事件数据库（文字、图片、音视频）', count: 1051 },
          { name: '国外外语教育人物数据库（知名学者、名师等生平、成就、网址信息等）', count: 1121 },
        ],
      },
      {
        name: '中国外语教育国际传播数据库（汉语、英语、俄语、日语、法语、朝鲜语、西语）',
        count: 6521,
        children: [
          { name: '外译成果文献库', count: 2217 },
          { name: '国外研究文献库', count: 2820 },
          { name: '中外外语教育交流事件数据库（学术会议、交流研讨、新闻报道等）', count: 2667 },
          { name: '中外外语教育平行语料库（汉语与英语、俄语、日语、法语、朝鲜语、西语形成多种语对）', count: 2158 },
        ],
      },
    ],
  },
]

const LANGUAGES = [
  { name: '中文', value: 60210, color: '#1f9c90' },
  { name: '英文', value: 78540, color: '#3d85cf' },
  { name: '日文', value: 19123, color: '#e8963c' },
  { name: '俄文', value: 13705, color: '#47a866' },
  { name: '韩文', value: 11342, color: '#8a6bc7' },
  { name: '泰文', value: 7680, color: '#d95f88' },
  { name: '德文', value: 5662, color: '#c9a227' },
  { name: '法文', value: 4124, color: '#4fa8ba' },
  { name: '西班牙文', value: 2233, color: '#9a6b52' },
  { name: '阿拉伯文', value: 1151, color: '#7f8fa6' },
]

const CATEGORIES = [
  { name: '期刊论文', value: 88762 },
  { name: '学位论文', value: 31050 },
  { name: '学术专著', value: 24707 },
  { name: '会议论文', value: 14725 },
  { name: '研究报告', value: 11932 },
  { name: '政策文献', value: 8529 },
  { name: '报纸文章', value: 4902 },
  { name: '标准与规范', value: 1830 },
]

/* 收录区间：1908 年至今。「覆盖年份」指标与文献时间图都按这条口径走 */
const COVERAGE_START = 1908
const COVERAGE_END = 2026

const YEARS = Array.from(
  { length: COVERAGE_END - COVERAGE_START + 1 },
  (_, i) => COVERAGE_START + i,
)

const YEAR_VALUES = [
  // 1908–1985：从零星几十篇逐步增长到千余篇
  96, 104, 112, 108, 121, 129, 137, 133, 145, 152, 160, 168,
  176, 184, 191, 187, 199, 208, 216, 224, 231, 240,
  247, 255, 249, 262, 271, 280, 288, 296, 305, 313,
  320, 311, 298, 286, 301, 318, 332, 345, 358, 371,
  384, 397, 410, 424, 438, 452, 466, 481, 496, 512,
  528, 545, 562, 580, 598, 617, 636, 656, 676, 697,
  718, 740, 763, 786, 810, 835, 860, 886, 913, 941,
  1000, 1090, 1180, 1290, 1420, 1600,
  // 1986–2026
  1853, 1920, 1926, 2108, 2250, 2210, 2407, 2377, 2649, 2650, 2888, 2937, 3042, 3362,
  3339, 3730, 3703, 3846, 3976, 4362, 4115, 4437, 4829, 4825, 4797, 4962, 5470, 5243,
  5984, 6044, 6026, 6555, 6644, 6784, 6855, 6673, 7589, 7101, 7896, 8051, 8022,
]


const barGradient = (from, to) =>
  new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: from },
    { offset: 1, color: to },
  ])

/* ---------------- 数据 ---------------- */
const loading = ref(true)
const databaseTree = ref([])
const languages = ref([])
const categories = ref([])
const years = ref([])

const countNodes = (nodes) => nodes.reduce((total, node) => total + 1 + countNodes(node.children || []), 0)
const corpusTotal = computed(() => languages.value.reduce((sum, item) => sum + item.value, 0) || TOTAL)
const databaseNodeCount = computed(() => databaseTree.value.length)
const subDatabaseCount = computed(() => Math.max(0, countNodes(databaseTree.value) - databaseTree.value.length))
/** 覆盖年份：与时间图同一条区间口径，不随数据条数变化 */
const yearRange = `${COVERAGE_START}–${COVERAGE_END}`

/** 知识库介绍卡：三大主题库 + 术语库 */
const introCards = computed(() => {
  // 顺序与 databaseTree 前三项一一对应：教育思想库 / 教育政策库 / 外语教育库
  const descs = [
    '教育思想经典与研究文献的专题库',
    '政策文本与治理议题的多语种文献集合',
    '外语教育与教学研究文献的主库',
  ]
  const cards = databaseTree.value.slice(0, 3).map((db, index) => ({
    name: db.name,
    desc: descs[index] || '主题文献集合',
    count: (Number(db.count) || 0).toLocaleString(),
    unit: '篇',
  }))
  cards.push({
    name: '术语库',
    desc: '教育领域术语的多语对照与规范译名',
    count: '21,846',
    unit: '条',
  })
  return cards
})

/** 全部数据库（含各级子库）按文献量排序，供条形图轮播 */
const flatNodes = computed(() => {
  const rows = []
  const walk = (nodes) => {
    nodes.forEach((node) => {
      rows.push({ name: node.name, value: Number(node.count) || 0 })
      walk(node.children || [])
    })
  }
  walk(databaseTree.value)
  return rows.filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
})

/** 语种只展示前 6 项，其余合并为「其他 N 项」 */
const topLanguages = computed(() => {
  const sorted = languages.value.slice().sort((a, b) => b.value - a.value)
  const head = sorted.slice(0, 6)
  const rest = sorted.slice(6)
  if (!rest.length) return head
  return [...head, {
    name: `其他 ${rest.length} 项`,
    value: rest.reduce((sum, item) => sum + item.value, 0),
    color: NEUTRAL,
  }]
})

/* ---------------- ECharts ---------------- */
const instances = {}
const mountChart = (id, builder) => {
  const dom = document.getElementById(id)
  if (!dom) return null
  if (!instances[id]) instances[id] = echarts.init(dom)
  instances[id].setOption(builder(), true)
  return instances[id]
}
const AXIS_LABEL = { color: '#8ba3a7', fontSize: 11.5 }
const SPLIT_LINE = { lineStyle: { color: '#eef2f3' } }

/** 库名按 12 字截断，保持单行不换行 */
const padBarName = (name) => (name.length > 12 ? `${name.slice(0, 12)}…` : name)


/* ---------------- 各数据库文献量：逐条滚动 ---------------- */
const WINDOW_SIZE = 8
const windowStart = ref(0)
const windowRows = computed(() => {
  const rows = flatNodes.value
  if (rows.length <= WINDOW_SIZE) return rows
  const start = windowStart.value % Math.max(1, rows.length - WINDOW_SIZE + 1)
  return rows.slice(start, start + WINDOW_SIZE)
})

let stepTimer = null
let autoPaused = false
const startStepping = () => {
  stopStepping()
  const total = flatNodes.value.length
  if (total <= WINDOW_SIZE) return
  stepTimer = window.setInterval(() => {
    if (autoPaused) return
    windowStart.value = (windowStart.value + 1) % (total - WINDOW_SIZE + 1)
    paintBar()
  }, 2000)
}
const stopStepping = () => {
  if (stepTimer) window.clearInterval(stepTimer)
  stepTimer = null
}
const handleBarEnter = () => {
  autoPaused = true
}
const handleBarLeave = () => {
  autoPaused = false
}


const paintBar = () =>
  mountChart('chart-bar', () => {
    const rows = windowRows.value
    return {
      grid: { left: 152, right: 54, top: 6, bottom: 6 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const hit = flatNodes.value.find(
            (item) => padBarName(item.name) === params[0].name,
          )
          const label = hit?.name || params[0].name
          return `${label}<br/>${Number(params[0].value || 0).toLocaleString()} 篇`
        },
      },
      xAxis: { type: 'value', splitLine: { show: false }, axisLabel: { show: false } },
      yAxis: {
        type: 'category',
        inverse: true,
        data: rows.map((item) => padBarName(item.name)),
        axisTick: { show: false },
        axisLine: { show: false },
        // align:left + margin 让文字从绘图区左侧 14px 处开始，实现真正的靠左展示
        axisLabel: {
          color: '#33595b',
          fontSize: 11,
          width: 128,
          overflow: 'truncate',
          align: 'left',
          margin: 140,
        },
      },
      series: [
        {
          type: 'bar',
          barWidth: 16,
          itemStyle: { borderRadius: [0, 8, 8, 0], color: barGradient('#0f8f8a', '#5cc8d6') },
          label: { show: true, position: 'right', color: '#5b7074', fontSize: 11.5 },
          data: rows.map((item) => item.value),
        },
      ],
    }
  })

const paintLanguage = () =>
  mountChart('chart-language', () => ({
    tooltip: { trigger: 'item', formatter: '{b}：{c} 篇（{d}%）' },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 10,
      textStyle: { color: '#33595b', fontSize: 10.5 },
      formatter: (name) => {
        const hit = topLanguages.value.find((item) => item.name === name)
        return `${name} ${hit ? hit.value.toLocaleString() : 0}`
      },
    },
    series: [
      {
        type: 'pie',
        roseType: 'radius',
        radius: ['18%', '62%'],
        center: ['50%', '42%'],
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 11, color: '#143437', formatter: '{b}\n{d}%' } },
        data: topLanguages.value.map((item, index) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: item.color || TEAL[index % TEAL.length] },
        })),
      },
    ],
  }))

const paintCategory = () =>
  mountChart('chart-category', () => {
    const rows = categories.value.slice(0, 8)
    return {
      grid: { left: 6, right: 10, top: 18, bottom: 6, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}：{c} 篇' },
      xAxis: {
        type: 'category',
        data: rows.map((item) => item.name),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e4eaec' } },
        axisLabel: { color: '#33595b', fontSize: 10.5, interval: 0, rotate: 28 },
      },
      yAxis: { type: 'value', splitLine: SPLIT_LINE, axisLabel: AXIS_LABEL },
      series: [
        {
          type: 'bar',
          barWidth: 14,
          itemStyle: {
            borderRadius: [8, 8, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#5cc8d6' },
              { offset: 1, color: '#0f8f8a' },
            ]),
          },
          label: { show: true, position: 'top', color: '#5b7074', fontSize: 10.5 },
          data: rows.map((item) => item.value),
        },
      ],
    }
  })

const paintYears = () =>
  mountChart('chart-years', () => ({
    grid: { left: 8, right: 16, top: 12, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', formatter: '{b} 年：{c} 篇' },
    xAxis: {
      type: 'category',
      data: years.value.map((item) => String(item.year)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e4eaec' } },
      axisLabel: { color: '#8ba3a7', fontSize: 10.5, interval: 'auto' },
    },
    yAxis: { type: 'value', splitLine: SPLIT_LINE, axisLabel: AXIS_LABEL },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        // 1908–2026 共 119 个点，点上圆点会挤成一片，点多时只画线
        showSymbol: years.value.length <= 40,
        lineStyle: { color: '#0f8f8a', width: 2 },
        itemStyle: { color: '#0f8f8a' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(15, 143, 138, 0.26)' },
            { offset: 1, color: 'rgba(15, 143, 138, 0.02)' },
          ]),
        },
        data: years.value.map((item) => item.count),
      },
    ],
  }))

const safePaint = (paint) => {
  try {
    paint()
  } catch (error) {
    console.error('[home] 图表渲染失败', paint?.name, error)
  }
}

const handleResize = () => Object.values(instances).forEach((chart) => chart?.resize())

/* ---------------- 加载真实数据 ---------------- */
const loadDashboard = async () => {
  loading.value = true
  try {
    databaseTree.value = JSON.parse(JSON.stringify(DATABASES))
    languages.value = LANGUAGES.map((item) => ({ name: item.name, value: item.value }))
    categories.value = CATEGORIES.map((item) => ({ name: item.name, value: item.value }))
    years.value = YEARS.map((year, index) => ({ year, count: YEAR_VALUES[index] || 0 }))

    await nextTick()
    safePaint(paintBar)
    safePaint(paintLanguage)
    safePaint(paintCategory)
    safePaint(paintYears)
  startStepping()
    window.setTimeout(handleResize, 0)
  } catch (error) {
    console.error('[home-showcase] 初始化失败', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDashboard()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  stopStepping()
  window.removeEventListener('resize', handleResize)
  Object.values(instances).forEach((chart) => chart?.dispose())
  Object.keys(instances).forEach((key) => delete instances[key])
})
</script>

<template>
  <div class="dashboard" v-loading="loading">
    <!-- 顶部窄条 -->
    <header class="topbar">
      <h1>
        <img class="brand-logo" src="@/assets/logo-wenchang-white.png" alt="文昌" />
        <span class="brand-colon" aria-hidden="true">：</span>
        <span class="brand-slogan">
          <strong>世界因教育而昌明</strong>
          <small>Civilizing the World through Education</small>
        </span>
      </h1>
      <div class="kpi-modules">
        <div class="kpi-card">
          <strong>{{ corpusTotal.toLocaleString() }}</strong><span>文献</span>
        </div>
        <div class="kpi-card">
          <strong>{{ databaseNodeCount }}</strong><span>主题库</span>
        </div>
        <div class="kpi-card">
          <strong>{{ subDatabaseCount }}</strong><span>子库</span>
        </div>
        <div class="kpi-card">
          <strong>{{ languages.length }}</strong><span>语种</span>
        </div>
        <div class="kpi-card">
          <strong>{{ categories.length }}</strong><span>文献类型</span>
        </div>
        <div class="kpi-card">
          <strong>{{ yearRange }}</strong><span>覆盖年份</span>
        </div>
      </div>    </header>

    <!-- 环绕式布局：左侧知识库介绍，右侧各数据库文献量，下方三张图表 -->
    <section class="grid">
      <article class="panel panel--intro">
        <header class="panel-head">
          <h2>知识库结构</h2>
        </header>
        <div class="intro-list">
          <div
            v-for="(card, index) in introCards"
            :key="card.name"
            class="intro-card"
            :class="`intro-card--${index + 1}`"
          >
            <span class="intro-index">0{{ index + 1 }}</span>
            <div class="intro-body">
              <strong class="intro-name">{{ card.name }}</strong>
              <p class="intro-desc">{{ card.desc }}</p>
            </div>
            <div class="intro-count">
              <b>{{ card.count }}</b>
              <span>{{ card.unit }}</span>
            </div>
          </div>
        </div>
      </article>

      <article class="panel panel--bar">
        <header class="panel-head">
          <h2>各数据库文献量</h2>
        </header>
        <div
          id="chart-bar"
          class="chart"
          @mouseenter="handleBarEnter"
          @mouseleave="handleBarLeave"
        ></div>
      </article>

      <article class="panel">
        <header class="panel-head">
          <h2>文献类型</h2>
        </header>
        <div id="chart-category" class="chart"></div>
      </article>

      <article class="panel">
        <header class="panel-head">
          <h2>文献语种</h2>
        </header>
        <div id="chart-language" class="chart"></div>
      </article>

      <article class="panel">
        <header class="panel-head">
          <h2>文献时间</h2>
        </header>
        <div id="chart-years" class="chart"></div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  --dash-ink: #143437;
  --dash-muted: #5b7074;
  --dash-line: #e8ebef;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 0 2px;
  color: var(--dash-ink);
  overflow: hidden;
}

/* ---------- 顶部条 ---------- */
.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 20px;
  min-height: 46px;
  padding: 6px 18px;
  border-radius: 10px;
  background: linear-gradient(to right, #005767 0%, #16736b 46%, #2a6aa6 100%);
  color: #fff;
  box-shadow: 0 6px 18px rgb(0 87 103 / 22%);
}

.topbar h1 {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.6px;
}

.topbar .brand-logo {
  height: 40px;
  width: auto;
  margin-right: 6px;
  object-fit: contain;
}

/* logo 与标语之间的冒号：与中文标语首行对齐，左右各留一点空隙 */
.topbar .brand-colon {
  flex: 0 0 auto;
  align-self: flex-start;
  margin: 4px 12px 0 0;
  color: #ffffff;
  font-family: 'Songti SC', 'STSong', 'Source Han Serif SC', serif;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  /* 宋体无粗体字形时允许合成，避免 '：' 看起来不够粗 */
  font-synthesis: weight;
}

.topbar .brand-slogan {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1px;
  padding-bottom: 0;
  margin-bottom: -2px;
}

.topbar .brand-slogan strong {
  color: #ffffff;
  font-family: 'Songti SC', 'STSong', 'Source Han Serif SC', serif;
  /* 与 logo 视觉等高：logo 40px，中文约 26px */
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 3px;
  line-height: 1.1;
}

.topbar .brand-slogan small {
  color: rgb(255 255 255 / 78%);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 9.5px;
  letter-spacing: 0.8px;
  line-height: 1.2;
}

.topbar h1 b {
  margin-right: 4px;
  color: #ffe27a;
  font-size: 1.4em;
  font-weight: 500;
  letter-spacing: 2px;
}

/* ---------- KPI 模块：嵌在首页顶栏右侧 ---------- */
.kpi-modules {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 8px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 66px;
  padding: 4px 11px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 8px;
  background: rgb(255 255 255 / 12%);
  line-height: 1.15;
}

.kpi-card strong {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.kpi-card span {
  color: rgb(255 255 255 / 74%);
  font-size: 11px;
}
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  /* 右列（各数据库文献量 / 文献时间）加宽约 20px，主图相应收窄 */
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.96fr) minmax(0, 1.02fr);
  grid-template-rows: minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 1.2fr);
  grid-template-areas:
    'main main bar'
    'main main bar'
    'category language years';
  gap: 10px;
}

/* 左上：知识库结构主图（最大） */
.panel--intro {
  grid-area: main;
}

/* 右侧：各数据库文献量（单列、两行高，尺寸更小） */
.panel--bar {
  grid-area: bar;
}

.grid > .panel:nth-of-type(3) {
  grid-area: category;
}

.grid > .panel:nth-of-type(4) {
  grid-area: language;
}

.grid > .panel:nth-of-type(5) {
  grid-area: years;
}

/* ---------- 知识库结构：单列卡片，间距更大填满主图 ---------- */
.intro-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding: 4px 0;
  overflow: auto;
}

.intro-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 18px 20px;
  border-radius: 10px;
  color: #eaf6f5;
  overflow: hidden;
}

.intro-card::after {
  content: '';
  position: absolute;
  top: -30%;
  right: -12%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgb(255 255 255 / 10%);
}

.intro-card--1 { background: linear-gradient(135deg, #0f8f8a 0%, #37b7ad 100%); }
.intro-card--2 { background: linear-gradient(135deg, #2f74b5 0%, #4aa3d8 100%); }
.intro-card--3 { background: linear-gradient(135deg, #b4762a 0%, #dDa24f 100%); }
.intro-card--4 { background: linear-gradient(135deg, #5b4b9e 0%, #8574c9 100%); }

.intro-index {
  position: relative;
  z-index: 1;
  align-self: flex-start;
  color: rgb(255 255 255 / 68%);
  font-family: Georgia, serif;
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 1px;
}

.intro-body {
  position: relative;
  z-index: 1;
  min-width: 0;
  flex: 1;
}

.intro-name {
  display: block;
  overflow: hidden;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.intro-desc {
  margin: 4px 0 0;
  overflow: hidden;
  color: rgb(255 255 255 / 82%);
  font-size: 13px;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.intro-count {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 62px;
}

.intro-count b {
  font-size: 27px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.intro-count span {
  margin-top: 3px;
  color: rgb(255 255 255 / 76%);
  font-size: 11.5px;
}

.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 10px 12px 8px;
  border: 1px solid var(--dash-line);
  border-radius: 10px;
  background: #fff;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.panel-head h2 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
}

.panel-head p {
  margin: 0;
  overflow: hidden;
  color: var(--dash-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart {
  flex: 1;
  min-height: 0;
  width: 100%;
}

/* ---------- 雷达轴名悬停提示 ---------- */



@media (max-width: 1280px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(4, minmax(0, 1fr));
    grid-template-areas:
      'main main'
      'lang category'
      'radar years'
      'share share';
  }
}
</style>
