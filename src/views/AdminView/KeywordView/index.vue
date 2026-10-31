<template>
  <div class="box">
    <div class="title">关键词统计</div>
    <div class="handle-box">
      <el-select v-model="selectCategory" class="handle-select mr10">
        <el-option key="1" label="名称" value="keyword"></el-option>
				
      </el-select>
      <el-input v-model="content" placeholder="请输入" class="handle-input mr10"></el-input>
      <el-button @click="serachKey" type="primary" icon="el-icon-search">搜索</el-button>
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
      <el-table  v-if="keywordsList.length > 0" :data="keywordsList" @selection-change="handleSelectionChange">
        <!--<el-table-column
          type="selection"
          width="60"
          align="center"
        ></el-table-column>-->
        <el-table-column label="名称" prop="keyword" show-overflow-tooltip align="center"></el-table-column>

        <el-table-column label="词频" prop="frequency" show-overflow-tooltip > </el-table-column>
        <el-table-column label="来源" width="150" prop="role">
          <template v-slot="scope">
            <span class="message-title">
              <el-tag :type="scope.row.role == '宿管人员' ? '' : 'primary'">{{ roleMap[scope.row.flag] || "未知角色" }}</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="200">
          <template v-slot="scope">
            <el-button type="text" icon="el-icon-remove" @click="changeKeyword(scope.$index, scope.row)">修改</el-button>
            <el-button
              type="text"
              icon="el-icon-delete"
              class="red"
              @click="deleteKey(scope.$index, scope.row.keyword_id)"
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
		<!-- 关键词增加 -->
		<el-dialog title="新增关键词" :model-value="dialogVisibleADD" @update:model-value="dialogVisibleADD = $event" width="50%">
			<div>
				<div class="addkey">
					<el-form :model="form" label-width="auto" style="max-width: 600px;width: 500px;">
						<el-form-item label="关键词">
							<el-input v-model="form.keyword" />
						</el-form-item>
						<el-form-item label="语种">
							<el-select v-model="form.language" placeholder="请选择语种">
							<el-option
									v-for="item in languages"
									:key="item.value"
									:label="item.label"
									:value="item.value"
								/>
							</el-select>
						</el-form-item>
					</el-form>
				</div>
			</div>
			<div class="buttons">
				<el-button type="success" role="button" tabindex="0" @click="addKey">确认</el-button>
				<el-button type="danger" role="button" tabindex="0" @click="dialogVisibleADD = false">取消</el-button>
			</div>
		</el-dialog>
		
		<!-- 关键词修改 -->
		<el-dialog title="修改关键词" :model-value="dialogVisibleUpdata" @update:model-value="dialogVisibleUpdata = $event" width="50%">
			<div class="updatakey">
				<el-form label-width="auto" style="max-width: 600px;width: 500px;">
					<el-form-item label="旧名称">
						<el-input v-model="msgDetail.keyword" disabled="true" />
					</el-form-item>
					<el-form-item label="旧语种">
						<el-input v-model="msgDetail.language" :value="languageText" disabled="true" />
					</el-form-item>
					<el-form-item label="新名称">
						<el-input v-model="changeForm.keyword" />
					</el-form-item>
					<el-form-item label="语种">
						<el-select v-model="changeForm.language" placeholder="请选择语种">
							<el-option
									v-for="item in languages"
									:key="item.value"
									:label="item.label"
									:value="item.value"
								/>
						</el-select>
					</el-form-item>
				</el-form>
			</div>
			<div class="buttons">
				<el-button type="success" role="button" tabindex="0" @click="SubmitKeyChange()">确认</el-button>
				<el-button type="danger" role="button" tabindex="0" @click="dialogVisibleUpdata = false">取消</el-button>
			</div>
		</el-dialog>
  </div>
</template>

<script>
import { getUnverify,getUserList,getKeywords,addKeyword,updataKeyword,deleteKeyword} from '@/api/admin.js'
import { getUserAvatar } from '@/api/user'
export default {
  name: "PeopleList",
  data() {
    return {
			dialogVisibleADD :false,
			dialogVisibleUpdata:false,
			keyword:"",
			
			currentPage: 1,
			total: 100,
			pageSize: 10,
			
			
      msgHistoryWithPic: [],
      selectCategory: "keyword",
      content: "",
			
      msgDetail: {},
			imgUrl:"",
			form:{},
			changeForm:{},
			languages:[{
				  value: 0,
				  label: '中文',
			},{
				  value: 1,
				  label: '英文',
			}],
			formModel:{},//条件选择
      selectedArr: [],
      keywordsList: [],
			value:0,
			options:[
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
    };
  },
  methods: {
			async	getList(data){
				const props = {
					page_size:this.pageSize,
					page_num:this.currentPage
					}
				data = { ...props, ...data };
				const res = await getKeywords(data)
				this.keywordsList = res.data.data.data
				this.total = res.data.data.total
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
			//添加新的关键词
			async addKey() {
				const data=this.form
				console.log(data)
				await addKeyword(data)
				this.keyword = ""
				this.dialogVisibleADD = false
			  this.getList()
				this.keywordsList = [...this.keywordsList];
			},
			//条件查询关键词
			serachKey(){
				if (this.selectCategory) {
					this.formModel = {}
					this.formModel[this.selectCategory] = this.content;
				}
				this.getList(this.formModel)
			},
			//修改关键词
			changeKeyword(index, msg) {
				this.dialogVisibleUpdata = true;
				this.msgDetail = msg;
			},
			async SubmitKeyChange(){
				try {
						const data = {
							keyword:this.changeForm.keyword,
							keyword_id:this.msgDetail.keyword_id,
							language:this.changeForm.language
						}
				    // 等待修改请求完成
				    await updataKeyword(data);
				    // 获取最新数据
						this.currentPage = 1
				    await this.getList();
						this.dialogVisibleUpdata = false;
				    // 强制刷新数组，确保 Vue 监听到变化
				    this.keywordsList = [...this.keywordsList];
				    console.log("数据已更新");
				  } catch (error) {
				    console.error("修改失败", error);
				    ElMessage.error("提交修改失败，请重试！");
				  }
			},
			//删除某关键词
			async deleteKey(index,data){
					this.$confirm("确认删除吗？", "提示", {
					  confirmButtonText: "确定",
					  cancelButtonText: "取消",
					  type: "warning",
					}).then(
					  // 确认删除
					  async () => {
					    try {
					        // 等待删除请求完成
					        await deleteKeyword(data);
					        // 获取最新数据
									this.currentPage = 1
					        this.getList();
					        // 强制刷新数组，确保 Vue 监听到变化
					        this.keywordsList = [...this.keywordsList];
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
	    roleMap() {
	      return {
	        0: "管理员",
	        1: "一般教师"
	      };
	    },
			languageText() {
				// 根据 msgDetail.language 的值返回对应的文本
				switch (this.msgDetail.language) {
					case 0:
						return '中文';
					case 1:
						return '英文';
					default:
						return '未知';
				}
			}
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
	padding: 80px 0;
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
