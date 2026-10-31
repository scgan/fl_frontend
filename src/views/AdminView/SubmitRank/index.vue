<template>
  <div class="box">
    <div class="header">
      <div class="title">上传文献排名</div>
      <el-button type="primary" @click="dialogVisible = true"> 导出数据 </el-button>
    </div>
    <!-- <div class="handle-box">
      <el-select v-model="selectCategory" class="handle-select mr10">
        <el-option key="1" label="姓名" value="name"></el-option>
        <el-option key="2" label="教职工号" value="username"></el-option>
        <el-option key="3" label="电话" value="phone"></el-option>
      </el-select>
      <el-input v-model="content" placeholder="请输入" class="handle-input mr10"></el-input>
      <el-button @click="serachPeople" type="primary" icon="el-icon-search">搜索</el-button>
      <el-button type="success" @click="reFresh">刷新</el-button>
    </div> -->
    <!-- 数据展示 -->
    <div class="container">
      <el-table
        v-if="adminList.length > 0"
        :data="adminList"
        @selection-change="handleSelectionChange"
      >
        <el-table-column label="序号" width="70">
          <template v-slot:default="scope">
            <span>{{ (currentPage - 1) * pageSize + scope.$index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="姓名" prop="name"></el-table-column>

        <el-table-column label="教职工号" prop="username"> </el-table-column>
        <el-table-column label="上传文献数量" prop="corpus_count"> </el-table-column>
        <!-- <el-table-column label="邮箱" show-overflow-tooltip prop="email"></el-table-column>
        <el-table-column label="手机号" show-overflow-tooltip prop="phone"></el-table-column>
        <el-table-column label="人员类型" width="250" prop="role">
          <template v-slot="scope">
            <span class="message-title">
              <el-tag
                v-for="(roleValue, index) in scope.row.role"
                :key="index"
                :type="roleValue === 0 ? '' : 'primary'"
                style="margin-right: 5px"
              >
                {{ roleMap[roleValue] || '未知角色' }}
              </el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="100" prop="check" align="center">
          <template v-slot="scope">
            <span class="message-title">
              <el-tag :type="scope.row.check == '0' ? 'warning' : 'success'">{{
                scope.row.status == '0' ? '未审核' : '已审核'
              }}</el-tag>
            </span>
          </template>
        </el-table-column> -->
        <el-table-column label="操作" align="center" width="200">
          <template v-slot="scope">
            <el-button
              type="text"
              icon="el-icon-remove"
              @click="changeRole(scope.$index, scope.row)"
              >查看详情</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </div>
    <!-- 导航区 -->
    <div class="footer">
      <el-pagination
        @size-change="handleSizeChange"
        background
        layout="total,sizes,prev,pager,next, jumper"
        :current-page.sync="currentPage"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pageSize"
        @current-change="pageChange"
        :hide-on-single-page="false"
        :total="total"
      >
      </el-pagination>
    </div>

    <el-dialog v-model="dialogVisible" title="Tips" width="500">
      <el-date-picker
        v-model="selectedDate2"
        type="date"
        placeholder="请选择统计开始时间"
        format="YYYY/MM/DD"
        value-format="YYYY-MM-DD"
        @change="getPunchSum"
      />
      ~
      <el-date-picker
        v-model="selectedDate3"
        type="date"
        placeholder="请选择统计结束时间"
        format="YYYY/MM/DD"
        value-format="YYYY-MM-DD"
        @change="getPunchSum"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="((dialogVisible = false), onExport())">
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      title="上传文献详情"
      :model-value="dialogVisiblePerson"
      @update:model-value="dialogVisiblePerson = $event"
      width="50%"
    >
      <el-table :data="corpusList">
        <!--<el-table-column
          type="selection"
          width="60"
          align="center"
        ></el-table-column>-->
        <el-table-column
          label="原文标题"
          prop="title_cn"
          show-overflow-tooltip
          align="center"
        ></el-table-column>

        <el-table-column label="译文标题" prop="title_en" show-overflow-tooltip> </el-table-column>
        <el-table-column
          label="语料类名"
          show-overflow-tooltip
          prop="category_name"
        ></el-table-column>
        <el-table-column label="语言" show-overflow-tooltip prop="language"></el-table-column>
        <!-- <el-table-column label="收集人" show-overflow-tooltip prop="name"></el-table-column> -->
        <!-- <el-table-column label="审核状态" width="100" prop="check" align="center">
          <template v-slot="scope">
            <span class="message-title">
              <el-tag :type="scope.row.check == '0' ? 'warning' : 'success'">{{ scope.row.status == "0" ? "未审核" : "已审核" }}</el-tag>
            </span>
          </template>
        </el-table-column> -->
        <!-- <el-table-column label="操作" align="center" width="100">
          <template v-slot="scope">
            <el-button
              type="text"
              icon="el-icon-remove"
              @click="handleDetail(scope.$index, scope.row)"
              >查看</el-button
            >
            <el-button
              type="text"
              icon="el-icon-delete"
              class="red"
              @click="handleDelete(scope.$index, scope.row)"
              >删除</el-button
            >
          </template>
        </el-table-column> -->
      </el-table>
      <!-- <div class="buttons">
        <el-button type="success" role="button" tabindex="0" @click="dialogVisiblePerson = false"
          >确认</el-button
        >
        <el-button type="danger" role="button" tabindex="0" @click="dialogVisiblePerson = false"
          >取消</el-button
        >
      </div> -->
    </el-dialog>
  </div>
</template>

<script>
import {
  getUnverify,
  getUserList,
  deletePerson,
  changeUserInfo,
  getCorList,
  exportScoreService,
} from '@/api/admin.js'
import { getUserAvatar } from '@/api/user'
export default {
  name: 'PeopleList',
  data() {
    return {
      selectedDate2: '',
      selectedDate3: '',
      dialogVisible: false,

      currentPage: 1,
      total: 100,
      pageSize: 10,

      msgHistoryWithPic: [],
      selectCategory: 'name',
      content: '',

      dialogVisiblePerson: false,
      corpusList: [],
      msgDetail: {},
      imgUrl: '',
      formModel: {}, //条件选择
      selectedArr: [],
      adminList: [],
      value: [],
      options: [
        {
          value: 0,
          label: '未知人员',
        },
        {
          value: 1,
          label: '二级管理员',
        },
        {
          value: 2,
          label: '语料收集者',
        },
      ],
    }
  },
  methods: {
    async getList(data) {
      const props = { status: 1 }
      data = { ...props, ...data }
      const res = await getUserList(data)
      this.adminList = res.data.data.data
      this.total = res.data.data.total
    },
    //条件获取列表
    //页大小改变的时候
    handleSizeChange(pageSize) {
      this.pageSize = pageSize
      this.formModel.page_size = pageSize
      this.getList(this.formModel)
    },
    //页数改变时候
    pageChange(page) {
      this.currentPage = page
      this.formModel.page_num = page
      this.getList(this.formModel)
    },
    // //输入框刷新
    // reFresh() {
    //   this.content = ''
    //   this.getList()
    // },
    // //条件查询人员
    // serachPeople() {
    //   if (this.selectCategory) {
    //     this.formModel = {}
    //     this.formModel[this.selectCategory] = this.content
    //   }
    //   console.log(this.formModel)
    //   this.getList(this.formModel)
    // },
    //查看上传详情
    async changeRole(index, row) {
      this.dialogVisiblePerson = true
      const res = await getCorList({ user_id: row.id, page_size: 9999, status: 2 })
      console.log(res)
      this.corpusList = res.data.data.data
      //   this.value = this.msgDetail.role
    },
    // async SubmitRoleChange() {
    //   try {
    //     this.msgDetail.role = this.value
    //     this.msgDetail.user_id = this.msgDetail.id
    //     // 等待修改请求完成
    //     await changeUserInfo(this.msgDetail)
    //     // 获取最新数据
    //     await this.getList()
    //     this.currentPage = 1
    //     this.dialogVisiblePerson = false
    //     // 强制刷新数组，确保 Vue 监听到变化
    //     this.adminList = [...this.adminList]
    //     console.log('数据已更新')
    //   } catch (error) {
    //     console.error('修改失败', error)
    //     ElMessage.error('提交修改失败，请重试！')
    //   }
    // },
    //删除某个人
    // async deletePerson(index, data) {
    //   // try {
    //   //     // 等待删除请求完成
    //   //     await deletePerson(data);
    //   //     // 获取最新数据
    //   //     await this.getList();
    //   //     // 强制刷新数组，确保 Vue 监听到变化
    //   //     this.adminList = [...this.adminList];
    //   //     console.log("数据已更新");
    //   //   } catch (error) {
    //   //     console.error("删除失败", error);
    //   //     ElMessage.error("删除失败，请重试！");
    //   //   }
    //   this.$confirm('确认删除吗？', '提示', {
    //     confirmButtonText: '确定',
    //     cancelButtonText: '取消',
    //     type: 'warning',
    //   }).then(
    //     // 确认删除
    //     () => {
    //       try {
    //         // 等待删除请求完成
    //         deletePerson(data)
    //         // 获取最新数据
    //         this.getList()
    //         this.currentPage = 1
    //         // 强制刷新数组，确保 Vue 监听到变化
    //         this.adminList = [...this.adminList]
    //         console.log('数据已更新')
    //       } catch (error) {
    //         console.error('删除失败', error)
    //         ElMessage.error('删除失败，请重试！')
    //       }
    //     },
    //     // 取消删除
    //     () => {
    //       this.$message.info('取消删除')
    //     },
    //   )
    // },
    //表单多选删除使用
    handleSelectionChange() {},
    async onExport() {
      // const start_time = new Date(this.selectedDate2 + ' 00:00:00')
      // const end_time = new Date(this.selectedDate3 + ' 00:00:00')
      try {
        const res = await exportScoreService({
          start_time: this.selectedDate2,
          end_time: this.selectedDate3,
        })
        const blob = res.data
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = '上传详情.xls'
        link.click()
        URL.revokeObjectURL(link.href)
      } catch (error) {
        console.error('Error downloading the file', error)
      }
    },
  },
  computed: {
    roleMap() {
      return {
        1: '二级管理员',
        2: '语料收集者',
      }
    },
    statusMap() {
      return {
        0: '待审核',
        1: '审核通过',
      }
    },
  },
  mounted() {
    // this.getMessageList(1);
    this.getList()
  },
}
</script>

<style scoped>
.box {
  padding: 10px;
  /* background-color: #D3D3D3; */
  color: white;
  background: linear-gradient(to bottom, #005767, white);
  /* c2e6ec  */
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  float: left;
  width: 400px;
  line-height: 50px;
  font-weight: bold;
  margin-left: 10px;
  font-size: 24px;
}
.handle-box {
  margin-bottom: 10px;
  line-height: 50px;
  float: right;
  padding-right: 10px;
}
.red {
  color: #ff0000;
}
.handle-select {
  width: 120px;
}
.handle-input {
  width: 300px;
  display: inline-block;
}
.mr10 {
  margin-right: 10px;
}
.footer {
  text-align: center;
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
.buttons {
  width: 40%;
  margin: auto;
  display: flex;
  justify-content: space-evenly;
}
</style>
