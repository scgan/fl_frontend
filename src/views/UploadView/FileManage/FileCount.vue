<template>
  <PageContainer title="文献统计" hide-header>
    <div
      style="
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      "
    >
      <div id="main" style="width: 600px; height: 400px"></div>
      <div id="main1" style="width: 600px; height: 400px"></div>
      <!-- <div id="main2" style="width: 600px; height: 400px"></div> -->
    </div>
    <h3 class="section-label">按数据库统计</h3>
    <div
      style="
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      "
    >
      <el-table
        style="width: 60%"
        :data="treeData"
        :row-key="rowKey"
        node-key="database_id"
        show-summary
        border
      >
        <el-table-column prop="database_name" label="数据库名称" width="500"> </el-table-column>
        <el-table-column prop="count" label="文献数量"> </el-table-column>
      </el-table>
    </div>
  </PageContainer>
</template>

<script setup>
import * as echarts from 'echarts'
import { getLanguageSumService, getCategorySumService, getDatabaseSumService } from '@/api/public'
import { ref } from 'vue'

function getAllDatabaseInfo(node) {
  let info = []

  // 检查当前节点是否有子节点
  if (node.children && node.children.length > 0) {
    // 如果有子节点，递归调用每个子节点
    for (let child of node.children) {
      info = info.concat(getAllDatabaseInfo(child)) // 合并结果
    }
  } else {
    // 如果没有子节点，说明是叶子节点，取出 database_name 和 count
    if (node.database_name) {
      info.push({
        database_name: node.database_name,
        count: node.count,
      })
    }
  }

  return info
}

const rowKey = 'database_id'
const treeData = ref([])
// 将接口返回数据进行处理
function processDepartmentData(departments) {
  console.log(departments)
  // 提取部门名称的数组
  let departmentNames
  // 计算每个部门的num之和
  const numSums = departments.map((dept) => dept.count)

  if (departments[0].hasOwnProperty('language'))
    departmentNames = departments.map((dept) => dept.language)
  else if (departments[0].hasOwnProperty('category_name'))
    departmentNames = departments.map((dept) => dept.category_name)
  else if (departments[0].hasOwnProperty('database_name'))
    departmentNames = departments.map((dept) => dept.database_name)

  // 返回包含部门名称和num之和的对象
  return {
    departmentNames,
    numSums,
  }
}
const getCount = async () => {
  const res = await getLanguageSumService()
  const res1 = await getCategorySumService()
  const res2 = await getDatabaseSumService()
  const results = processDepartmentData(res.data.data)
  const results1 = processDepartmentData(res1.data.data)
  treeData.value = res2.data.data
  // 假设 departments 是树形结构的根节点数组
  // const results2 = processDepartmentData(
  //   res2.data.data.reduce((acc, dept) => {
  //     return acc.concat(getAllDatabaseInfo(dept))
  //   }, []),
  // )
  // console.log(results2)
  const myChart = echarts.init(document.getElementById('main'))
  const myChart1 = echarts.init(document.getElementById('main1'))
  // const myChart2 = echarts.init(document.getElementById('main2'))
  myChart.setOption({
    title: {
      text: '按语言统计',
    },
    tooltip: {},
    xAxis: {
      data: results.departmentNames,
      axisLabel: {
        rotate: 45, // 旋转标签，避免重叠
        interval: 0, // 显示所有标签,
      },
    },
    yAxis: {},
    series: [
      {
        name: '文献数量',
        type: 'bar',
        data: results.numSums,
        // 直接在 series 对象中设置 label 配置
        label: {
          show: true, // 显示标签
          position: 'top', // 标签在柱子外部显示
          // textStyle: {
          color: '#000', // 文字颜色
          fontSize: 14, // 字体大小
          // },
          // 显示数据项的值
          formatter: '{c}',
        },
      },
    ],
  })
  myChart1.setOption({
    title: {
      text: '按文献类型统计',
    },
    tooltip: {},
    xAxis: {
      data: results1.departmentNames,
      axisLabel: {
        rotate: 45, // 旋转标签，避免重叠
        interval: 0, // 显示所有标签,
      },
    },
    yAxis: {},
    series: [
      {
        name: '文献数量',
        type: 'bar',
        data: results1.numSums,
        // 直接在 series 对象中设置 label 配置
        label: {
          show: true, // 显示标签
          position: 'top', // 标签在柱子外部显示
          // textStyle: {
          color: '#000', // 文字颜色
          fontSize: 14, // 字体大小
          // },
          // 显示数据项的值
          formatter: '{c}',
        },
      },
    ],
  })
  // myChart2.setOption({
  //   title: {
  //     text: '按数据库统计',
  //   },
  //   tooltip: {},
  //   xAxis: {
  //     data: results2.departmentNames,
  //     axisLabel: {
  //       rotate: 45, // 旋转标签，避免重叠
  //       interval: 0, // 显示所有标签,
  //       wordWrap: true, // 允许换行
  //     },
  //   },
  //   yAxis: {},
  //   series: [
  //     {
  //       name: '文献数量',
  //       type: 'bar',
  //       data: results2.numSums,
  //       // 直接在 series 对象中设置 label 配置
  //       label: {
  //         show: true, // 显示标签
  //         position: 'top', // 标签在柱子外部显示
  //         // textStyle: {
  //         color: '#000', // 文字颜色
  //         fontSize: 14, // 字体大小
  //         // },
  //         // 显示数据项的值
  //         formatter: '{c}',
  //       },
  //     },
  //   ],
  // })
}
getCount()
</script>

<style scoped>
/* 分区小标题：比页内大标题轻，图表区紧贴顶部，明细标题只作分隔 */
.section-label {
  margin: 18px 0 10px;
  padding-left: 9px;
  border-left: 3px solid #005767;
  color: #143437;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}
</style>
