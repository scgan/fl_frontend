<template>
  <div class="box">
    <div class="title">语料库设置</div>
    <div class="handle-box">
      <el-select v-model="selectCategory" class="handle-select mr10">
        <el-option key="1" label="名称" value="category_name"></el-option>
				
      </el-select>
      <el-input v-model="content" placeholder="请输入" class="handle-input mr10"></el-input>
      <el-button @click="serachCor" type="primary" icon="el-icon-search">搜索</el-button>
      <el-button type="success" @click="this.dialogVisibleADD = true">添加</el-button>
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
      <el-table  v-if="corpusList.length > 0" :data="corpusList" @selection-change="handleSelectionChange">
        <!--<el-table-column
          type="selection"
          width="60"
          align="center"
        ></el-table-column>-->
        <el-table-column label="名称" prop="category_name" show-overflow-tooltip align="center"></el-table-column>

        <el-table-column label="编号" prop="code" show-overflow-tooltip > </el-table-column>
        
        <el-table-column label="操作" align="center" width="200">
          <template v-slot="scope">
            <el-button type="text" icon="el-icon-remove" @click="changeCor(scope.$index, scope.row)">修改</el-button>
            <el-button
              type="text"
              icon="el-icon-delete"
              class="red"
              @click="deleteCOR(scope.$index, scope.row.keyword_id)"
              >删除</el-button
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
        :total="total">
      </el-pagination>
    </div>
		<!-- 语料库增加 -->
		<el-dialog title="新增关键词" :model-value="dialogVisibleADD" @update:model-value="dialogVisibleADD = $event" width="50%">
			<div>
				<div class="addkey">
					<span style="line-height: 33px;">名称：</span><el-input v-model="category_name" placeholder="请输入" class="handle-input mr10"></el-input>
				</div>
				<div class="addkey">
					<span style="line-height: 33px;">编码：</span><el-input v-model="code" placeholder="请输入" class="handle-input mr10"></el-input>
				</div>
			</div>
			<div class="buttons">
				<el-button type="success" role="button" tabindex="0" @click="addCor">确认</el-button>
				<el-button type="danger" role="button" tabindex="0" @click="dialogVisibleADD = false">取消</el-button>
			</div>
		</el-dialog>
		
		<!-- 语料库修改 -->
		<el-dialog title="修改关键词" :model-value="dialogVisibleUpdata" @update:model-value="dialogVisibleUpdata = $event" width="50%">
			<div>
				<div class="updatakey">
					<span style="line-height: 33px;width: 60px;">旧名称：</span><el-input v-model="msgDetail.category_name" placeholder="请输入" class="handle-input mr10" disabled="true"></el-input>
					<span style="line-height: 33px;width: 60px;">旧编码：</span><el-input v-model="msgDetail.code" placeholder="请输入" class="handle-input mr10" disabled="true"></el-input>
				</div>
				<div class="updatakey">
					<span style="line-height: 33px;width: 60px;">新名称：</span><el-input v-model="category_name" placeholder="请输入" class="handle-input mr10"></el-input>
					<span style="line-height: 33px;width: 60px;">新编码：</span><el-input v-model="code" placeholder="请输入" class="handle-input mr10"></el-input>
				</div>
			</div>
			<div class="buttons">
				<el-button type="success" role="button" tabindex="0" @click="SubmitCorChange()">确认</el-button>
				<el-button type="danger" role="button" tabindex="0" @click="dialogVisibleUpdata = false">取消</el-button>
			</div>
		</el-dialog>
  </div>
</template>

<script>
import { getUnverify,getUserList,getCorpus,addCorpus,updataCorpus,deleteCorpus} from '@/api/admin.js'
import { getUserAvatar } from '@/api/user'
export default {
  name: "PeopleList",
  data() {
    return {
			dialogVisibleADD :false,
			dialogVisibleUpdata:false,
			category_name:"",
			code:"",
			
			currentPage: 1,
			total: 100,
			pageSize: 10,
			
			
      msgHistoryWithPic: [],
      selectCategory: "category_name",
      content: "",
			
      msgDetail: {},
			imgUrl:"",
			formModel:{},//条件选择
      selectedArr: [],
      corpusList: [],
			value:0,
    };
  },
  methods: {
			async	getList(data){
				const props = {
					page_size:this.pageSize,
					page_num:this.currentPage
					}
				data = { ...props, ...data };
				const res = await getCorpus(data)
				this.corpusList = res.data.data
				this.total = res.data.total
			},
			//条件获取列表
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
			//添加新的语料库
			async addCor() {
				const data={
					category_name:this.category_name,
					code:this.code
				}
				await addCorpus(data)
				this.category_name = ""
				this.code = ""
				this.dialogVisibleADD = false
			  this.getList()
				this.corpusList = [...this.corpusList];
			},
			//条件查询语料库
			serachCor(){
				if (this.selectCategory) {
					this.formModel = {}
					this.formModel[this.selectCategory] = this.content;
				}
				this.getList(this.formModel)
			},
			//修改语料库
			changeCor(index, msg) {
				this.dialogVisibleUpdata = true;
				this.msgDetail = msg;
			},
			async SubmitCorChange(){
				try {
						const data = {
							category_name:this.category_name,
							code:this.code,
							category_id:this.msgDetail.category_id
						}
				    // 等待修改请求完成
				    await updataCorpus(data);
				    // 获取最新数据
						this.currentPage = 1
				    await this.getList();
						this.dialogVisibleUpdata = false;
				    // 强制刷新数组，确保 Vue 监听到变化
				    this.corpusList = [...this.corpusList];
				    console.log("数据已更新");
				  } catch (error) {
				    console.error("修改失败", error);
				    ElMessage.error("提交修改失败，请重试！");
				  }
			},
			//删除某关键词
			async deleteCor(index,data){
					this.$confirm("确认删除吗？", "提示", {
					  confirmButtonText: "确定",
					  cancelButtonText: "取消",
					  type: "warning",
					}).then(
					  // 确认删除
					  async () => {
					    try {
					        // 等待删除请求完成
					        await deleteCorpus(data);
					        // 获取最新数据
									this.currentPage = 1
					        this.getList();
					        // 强制刷新数组，确保 Vue 监听到变化
					        this.corpusList = [...this.corpusList];
					        console.log("数据已更新");
					      } catch (error) {
					        console.error("删除失败", error);
					        ElMessage.error("删除失败，请重试！");
					      }
					  },
					  // 取消删除
					  () => {
					    this.$message.info("取消删除");
					  }
					);
			},
			//表单多选删除使用
			handleSelectionChange(){
				
			},
  },
	computed: {
	},
  mounted() {
    // this.getMessageList(1);
    this.getList()
  },
};
</script>

<style scoped>
.updatakey{
	display: flex;
	justify-content: center;
	padding: 10px 0;
}
.addkey{
	display: flex;
	justify-content: center;
	padding: 10px 0;
}
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
</style>
