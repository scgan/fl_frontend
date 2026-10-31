<template>
  <div class="box">
    <div class="title">数据库树形结构</div>
    <div class="handle-box">
      <el-button type="success" @click="dialogVisible1 = true">添加一级数据库</el-button>
    </div>
		<!-- 数据展示 -->
    <div class="container">
			<el-tree
				:data="TreeData"
				show-checkbox
				node-key="id"
				default-expand-all
				:expand-on-click-node="false"
				:props="defaultProps"
			>
				<template #default="{ node, data }">
					<span class="custom-tree-node">
						<span>{{ node.label }}</span>
						<span>
							<a @click="append(data)"> 增加 </a>
							<a style="margin-left: 8px" @click="remove(data)"> 删除 </a>
						</span>
					</span>
				</template>
			</el-tree>
    </div>
		<div>
			<el-dialog
				v-model="dialogVisible"
				title="添加数据库"
				width="900"
				:before-close="handleClose"
			>
				<el-form label-width="100px" :model="msgDetail">
					<el-form-item >
					  <el-col :span="7">
					    <el-form-item label="">
					      <span class="text">{{  }}</span>
					    </el-form-item>
					  </el-col>
					  <el-col :span="10">
					    <el-form-item label="父数据库名称">
					      <el-input v-model="nowTreedata.database_name" placeholder="请输入" class="handle-input mr10"></el-input>
					    </el-form-item>
					  </el-col>
					  <el-col :span="7">
					    <el-form-item label="">
					      <span class="text">{{  }}</span>
					    </el-form-item>
					  </el-col>
					</el-form-item>
				  <el-form-item>
				    <el-col :span="7">
				      <el-form-item label="">
				        <span class="text">{{  }}</span>
				      </el-form-item>
				    </el-col>
				    <el-col :span="10">
				      <el-form-item label="子数据库名称">
				        <el-input v-model="content" placeholder="请输入" class="handle-input mr10"></el-input>
				      </el-form-item>
				    </el-col>
				    <el-col :span="7">
				      <el-form-item label="">
				        <span class="text">{{  }}</span>
				      </el-form-item>
				    </el-col>
				  </el-form-item>
				</el-form>
				<template #footer>
					<div class="dialog-footer">
						<el-button @click="dialogVisible = false,content=''">取消</el-button>
						<el-button type="primary" @click="addDatabase">
							确认
						</el-button>
					</div>
				</template>
			</el-dialog>
			
			<el-dialog
				v-model="dialogVisible1"
				title="添加数据库"
				width="900"
				:before-close="handleClose"
			>
				<el-form label-width="120px" :model="msgDetail">
				  <el-form-item>
				    <el-col :span="7">
				      <el-form-item label="">
				        <span class="text">{{  }}</span>
				      </el-form-item>
				    </el-col>
				    <el-col :span="10">
				      <el-form-item label="一级数据库名称">
				        <el-input v-model="content" placeholder="请输入" class="handle-input mr10"></el-input>
				      </el-form-item>
				    </el-col>
				    <el-col :span="7">
				      <el-form-item label="">
				        <span class="text">{{  }}</span>
				      </el-form-item>
				    </el-col>
				  </el-form-item>
				</el-form>
				<template #footer>
					<div class="dialog-footer">
						<el-button @click="dialogVisible1 = false,content=''">取消</el-button>
						<el-button type="primary" @click="addRoot()">
							确认
						</el-button>
					</div>
				</template>
			</el-dialog>
			
		</div>
  </div>
</template>

<script>
import { getDatabaseTree,addDatabaseTree,deleteDatabaseTree} from '@/api/admin.js'
import { getUserAvatar } from '@/api/user'

export default {
  name: "VerifyPeople",
  data() {
    return {
			TreeData:[],
			defaultProps: {
				children: "children", // 如果你的数据有子节点
				label: "database_name", // 指定 `label` 使用 `database_name`
			},
			total:1000,
			newChild:{},
			nowTreedata:{},
			dialogVisible:false,
			dialogVisible1:false,
			content:"",
    };
  },
  methods: {
			async getTreeData(){
				const res = await getDatabaseTree()
				this.TreeData = res.data.data
			},
			append(data){
				this.dialogVisible = true
				this.nowTreedata = data
			},
			async addDatabase(){
				this.newChild.database_name = this.content
				this.newChild.parent_id = this.nowTreedata.id
				await addDatabaseTree(this.newChild)
				this.getTreeData()
				this.TreeData = [...this.TreeData]
				this.dialogVisible = false
				this.content = ""
			},
			async remove(data){
				const datas={database_id:data.id}
				await deleteDatabaseTree(datas)
				this.getTreeData()
				this.TreeData = [...this.TreeData]
			},
			async addRoot(){
				this.newChild.database_name = this.content
				this.newChild.parent_id = -1
				await addDatabaseTree(this.newChild)
				this.getTreeData()
				this.TreeData = [...this.TreeData]
				this.dialogVisible1 = false
				this.content = ""
			},
  },
	computed: {
	},
  mounted() {
    // this.getMessageList(1);
		this.getTreeData()
  },
};
</script>

<style scoped>
.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
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
  /* float: right; */
  padding-right: 10px;
	margin-left: 90%;
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
