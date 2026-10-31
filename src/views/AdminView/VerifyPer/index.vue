<template>
  <div class="box">
    <div class="title">人员列表（未审核）</div>
    <div class="handle-box">
      <el-select v-model="selectCategory" class="handle-select mr10">
        <el-option key="1" label="姓名" value="name"></el-option>
				<el-option key="2" label="教职工号" value="username"></el-option>
				<el-option key="3" label="电话" value="phone"></el-option>
      </el-select>
      <el-input v-model="content" placeholder="请输入" class="handle-input mr10"></el-input>
      <el-button @click="serachPeople" type="primary" icon="el-icon-search">搜索</el-button>
      <el-button type="success" @click="reFresh">刷新</el-button>
      <!-- <el-button
        @click="dialogVisible = true"
        type="success"
        icon="el-icon-circle-plus-outline"
        >添加管理员</el-button
      > -->
      <!-- <el-button type="warning" @click="isPass" icon="el-icon-circle-check"
        >通过审核</el-button
      > -->
    </div>
    <!-- 数据展示 -->
    <div class="container">
      <el-table  v-if="adminList.length > 0" :data="adminList" @selection-change="handleSelectionChange">
        <!--<el-table-column
          type="selection"
          width="60"
          align="center"
        ></el-table-column>-->
        <el-table-column label="姓名" prop="name" show-overflow-tooltip align="center"></el-table-column>

        <el-table-column label="教职工号" prop="username" show-overflow-tooltip > </el-table-column>
        <el-table-column label="邮箱" show-overflow-tooltip prop="email"></el-table-column>
        <el-table-column label="手机号" show-overflow-tooltip prop="phone"></el-table-column>
        <el-table-column label="人员类型" width="150" prop="role">
          <template v-slot="scope">
            <span class="message-title">
              <el-tag :type="scope.row.role == '宿管人员' ? '' : 'primary'">{{ roleMap[scope.row.role] || "未知角色" }}</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="100" prop="check" align="center">
          <template v-slot="scope">
            <span class="message-title">
              <el-tag :type="scope.row.check == '0' ? 'warning' : 'success'">{{ scope.row.status == "0" ? "未审核" : "已审核" }}</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="100">
          <template v-slot="scope">
            <el-button type="text" icon="el-icon-remove" @click="handleDetail(scope.$index, scope.row)">审核</el-button>
            <!--<el-button
              type="text"
              icon="el-icon-delete"
              class="red"
              @click="handleDelete(scope.$index, scope.row)"
              >删除</el-button
            >-->
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
        @next-click="currentPage++"
        @prev-click="currentPage--"
        :hide-on-single-page="false"
        :total="total">
      </el-pagination>
    </div>

		<el-dialog title="人员详情" :model-value="dialogVisiblePerson" @update:model-value="dialogVisiblePerson = $event" width="50%">
			<el-form label-width="80px" :model="msgDetail">
			  <el-form-item>
			    <el-col :span="8">
			      <el-form-item label="姓名">
			        <span class="text">{{ msgDetail.name }}</span>
			      </el-form-item>
			    </el-col>
			    <el-col :span="8">
			      <el-form-item label="教工号">
			        <span class="text">{{ msgDetail.username }}</span>
			      </el-form-item>
			    </el-col>
			    <el-col :span="8">
			      <el-form-item label="邮箱">
			        <span class="text">{{ msgDetail.email }}</span>
			      </el-form-item>
			    </el-col>
			  </el-form-item>
			  <el-form-item>
			    <el-col :span="8">
			      <el-form-item label="手机号">
			        <span class="text">{{ msgDetail.phone }}</span>
			      </el-form-item>
			    </el-col>
			    <el-col :span="8">
			      <el-form-item label="角色">
			        <span class="text">{{ roleMap[msgDetail.role] || "未知角色" }}</span>
			      </el-form-item>
			    </el-col>
			  </el-form-item>
				<el-form-item>
					<el-col :span="8">
			      <el-form-item label="图片">
		<!-- 	        <span v-if="msgDetail.is_graduate" class="text">毕业</span>
			        <span v-else class="text">在校</span> -->
			      </el-form-item>
			    </el-col>
				</el-form-item>
			  <el-form-item>
			    <el-col :span="8">
			      <el-form-item>
			        <el-image :src="imgUrl" fit="contain" :preview-src-list="msgDetail.photoList" style="width: 75%; height: 210px; border: #005767 1px dashed" :class="{ 'is-enlarged': isEnlarged }" @click="toggleEnlarge"></el-image>
			      </el-form-item>
			    </el-col>
			  </el-form-item>
			</el-form>
			<div class="buttons">
				<el-button type="success" role="button" tabindex="0" @click="VerifyPer(0)">通过</el-button>
				<el-button type="danger" role="button" tabindex="0" @click="VerifyPer(1)">不予通过</el-button>
			</div>
		</el-dialog>
  </div>
</template>

<script>
import { getUnverify,passPerson,deletePerson} from '@/api/admin.js'
import { getUserAvatar } from '@/api/user'
export default {
  name: "VerifyPeople",
  data() {
    return {
      isEnlarged: false,

			currentPage: 1,
			total: 100,
			pageSize: 10,


      msgHistoryWithPic: [],
      selectCategory: "name",
      content: "",

      dialogVisiblePerson: false,

      msgDetail: {},
			imgUrl:"",
			formModel:{},//条件选择
      selectedArr: [],
      adminList: [],
      currentPage: 1,
      totalPage: 0,
    };
  },
  methods: {
      toggleEnlarge() {
				this.isEnlarged = !this.isEnlarged
			},

			async	getList(data){
				const res = await getUnverify(data)
				this.total = res.data.data.total
				this.adminList = res.data.data.users
			},
			//页大小改变的时候
			handleSizeChange(pageSize){
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
			//输入框刷新
			reFresh() {
				this.content = ""
			  this.getList()
			},
			//条件查询人员
			serachPeople(){
				if (this.selectCategory) {
					this.formModel = {}
					this.formModel[this.selectCategory] = this.content;
				}
				console.log(this.formModel)
				this.getList(this.formModel)
			},
			//获取人员个人信息
			async	handleDetail(index, msg) {
			  this.imgUrl = ''
			  this.dialogVisiblePerson = true;
			  this.msgDetail = msg;
				try {
					const res = await getUserAvatar(msg.id)
					const url = URL.createObjectURL(res.data)
					this.imgUrl = url
				} catch(err) {
				}
			},
			async VerifyPer(data){
				try {
				    // 等待删除请求完成
				    await passPerson({
				      user_id: this.msgDetail.id,
				      operation: data
				    });
				    // 关闭弹窗
				    this.dialogVisiblePerson = false;
				    // 获取最新数据
				    await this.getList();
				    // 强制刷新数组，确保 Vue 监听到变化
				    this.adminList = [...this.adminList];
				    console.log("数据已更新");
				  } catch (error) {
				    console.error("删除失败", error);
				    ElMessage.error("删除失败，请重试！");
				  }
			},
			//表单多选删除使用
			handleSelectionChange(){

			},
  },
	computed: {
	    roleMap() {
	      return {
	        1: "二级管理员",
	        2: "语料收集者"
	      };
	    },
			statusMap(){
				return {
				  0: "待审核",
				  1: "审核通过"
				};
			},
	},
  mounted() {
    // this.getMessageList(1);
    this.getList()
  },
};
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
.buttons{
		width: 80%;
		margin: auto;
	  display: flex;
	  justify-content: space-evenly;
}
.is-enlarged {
  transition: transform 0.3s ease;
  transform: scale(2.5); /* 放大1.5倍 */
}
</style>
