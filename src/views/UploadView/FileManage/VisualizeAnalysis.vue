<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { corpusTimelineService } from '@/api/collector'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'

const route = useRoute()
const chartData = ref(null) // 存储图表数据
const loading = ref(false)
const lineInstance = ref(null) // 折线图实例
const barInstance = ref(null) // 柱状图实例
const pieInstance = ref(null) // 饼图实例

// 从路由参数获取文献ID
const corpusIds = ref([])
if (route.query.ids) {
  corpusIds.value = route.query.ids.split(',').map(id => parseInt(id))
}

// 初始化时获取数据并绘制图表
onMounted(async () => {
  console.log('VisualizeAnalysis onMounted 被调用')
  console.log('检查sessionStorage中的AI跳转数据')

  // 优先检查 sessionStorage 中的图表数据（从AI问答页面跳转）
  const chartDataFromStorage = sessionStorage.getItem('aiJumpChartData')

  if (chartDataFromStorage) {
    console.log('接收到从AI问答页面传递的图表数据')

    try {
      const parsedChartData = JSON.parse(chartDataFromStorage)

      // 直接使用传递的数据
      chartData.value = {
        chart_data: parsedChartData
      }

      ElMessage.success('已加载AI生成的可视化数据')

      // 等待DOM更新后再初始化图表
      await nextTick()
      initAllCharts()

      // 清除数据，防止刷新后重复加载
      sessionStorage.removeItem('aiJumpChartData')
      console.log('已清除sessionStorage中的图表数据')
      return
    } catch (error) {
      console.error('解析图表数据失败:', error)
      ElMessage.error('图表数据解析失败')
    }
  }

  // 如果没有传递图表数据，则从路由参数获取文献ID并调用接口
  if (corpusIds.value.length === 0) {
    ElMessage.warning('缺少必要的文献ID参数')
    return
  }

  loading.value = true
  try {
    // 调用接口获取数据
    const res = await corpusTimelineService({
      corpus_ids: corpusIds.value
    })

    if (res.data.code === 200) {
      chartData.value = res.data.data
      ElMessage.success('数据获取成功')
      // 等待DOM更新后再初始化图表
      await nextTick()
      initAllCharts()
    } else {
      ElMessage.error(`数据获取失败: ${res.data.msg}`)
    }
  } catch (error) {
    console.error('数据获取失败:', error)
    ElMessage.error('数据获取失败，请重试')
  } finally {
    loading.value = false
  }
})

const initAllCharts = () => {
  // 销毁之前的实例
  if (lineInstance.value) {
    lineInstance.value.dispose()
  }
  if (barInstance.value) {
    barInstance.value.dispose()
  }
  if (pieInstance.value) {
    pieInstance.value.dispose()
  }

  // 获取DOM元素
  const lineDom = document.getElementById('line-chart')
  const barDom = document.getElementById('bar-chart')
  const pieDom = document.getElementById('pie-chart')

  if (!lineDom || !barDom || !pieDom) {
    console.error('找不到图表DOM元素')
    return
  }

  // 初始化ECharts实例
  lineInstance.value = echarts.init(lineDom)
  barInstance.value = echarts.init(barDom)
  pieInstance.value = echarts.init(pieDom)

  // 设置配置项
  lineInstance.value.setOption(getLineOption())
  barInstance.value.setOption(getBarOption())
  pieInstance.value.setOption(getPieOption())

  // 响应窗口大小变化
  window.addEventListener('resize', () => {
    lineInstance.value.resize()
    barInstance.value.resize()
    pieInstance.value.resize()
  })
}

// 生成折线图配置
const getLineOption = () => {
  if (!chartData.value || !chartData.value.chart_data) {
    return {}
  }

  const data = chartData.value.chart_data.map((item) => ({
    name: item.label,
    value: item.count,
  }))

  return {
    title: {
      text: '文献趋势分析',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985',
        },
      },
    },
    legend: {
      data: ['数量'],
      top: 30,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map((item) => item.name),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '数量',
        type: 'line',
        data: data.map((item) => item.value),
        smooth: true,
        lineStyle: {
          color: '#5470c6',
        },
        itemStyle: {
          color: '#5470c6',
        },
      },
    ],
  }
}

// 生成柱状图配置
const getBarOption = () => {
  if (!chartData.value || !chartData.value.chart_data) {
    return {}
  }

  const data = chartData.value.chart_data.map((item) => ({
    name: item.label,
    value: item.count,
  }))

  return {
    title: {
      text: '文献分布统计',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.name),
      axisTick: {
        alignWithLabel: true,
      },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '数量',
        type: 'bar',
        barWidth: '60%',
        data: data.map((item) => item.value),
        itemStyle: {
          color: '#7ebae4',
        },
      },
    ],
  }
}

// 生成饼图配置
const getPieOption = () => {
  if (!chartData.value || !chartData.value.chart_data) {
    return {}
  }

  const data = chartData.value.chart_data.map((item) => ({
    name: item.label,
    value: item.count,
  }))

  return {
    title: {
      text: '文献占比分析',
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '数量',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '18',
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: false,
        },
        data: data,
      },
    ],
  }
}

// 组件卸载时销毁图表实例
onUnmounted(() => {
  if (lineInstance.value) {
    lineInstance.value.dispose()
  }
  if (barInstance.value) {
    barInstance.value.dispose()
  }
  if (pieInstance.value) {
    pieInstance.value.dispose()
  }
})
</script>

<template>
  <div class="chart-page">
    <!-- 页面标题已移到顶部栏 -->

    <!-- 图表容器 -->
    <div class="chart-container" v-if="chartData">
      <div class="charts-wrapper">
        <div class="chart-card">
          <h3>折线图</h3>
          <div id="line-chart" class="chart-item"></div>
        </div>
        <div class="chart-card">
          <h3>柱状图</h3>
          <div id="bar-chart" class="chart-item"></div>
        </div>
        <div class="chart-card">
          <h3>饼图</h3>
          <div id="pie-chart" class="chart-item"></div>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loading" class="loading-state">
      <div class="loading-content">
        <p>正在加载数据...</p>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <p>暂无数据可显示</p>
    </div>
  </div>
</template>

<style scoped>
.chart-page {
  padding: 20px;
  min-height: 85vh;
  background-color: #f8f9fa;
}

.page-title {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.chart-container {
  display: flex;
  justify-content: center;
  width: 100%;
}

/* 图表容器样式 */
.charts-wrapper {
  display: flex;
  gap: 20px;
  width: 100%;
  max-width: 1400px;
  flex-wrap: wrap;
  justify-content: center;
}

.chart-card {
  flex: 1;
  min-width: 400px;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.chart-card h3 {
  text-align: center;
  margin: 0 0 15px 0;
  color: #333;
}

.chart-item {
  width: 100%;
  height: 400px;
}

.loading-state,
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  font-size: 18px;
  color: #666;
}
</style>
