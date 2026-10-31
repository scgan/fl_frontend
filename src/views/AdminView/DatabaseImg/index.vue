<template>
  <div class="box">
		<!-- header部分 -->
    <div class="title">数据库树形结构</div>
    <div class="handle-box">
      <el-button type="success" @click="dialogVisible1 = true" style="visibility: hidden;">添加一级数据库</el-button>
    </div>
		<!-- 图片展示 -->
    <div class="container">
			<div class="cards">
				<el-card v-for="dabebase in flatDatabaseList" :key="dabebase.id" @click="GoDatebase(dabebase)">
					<template #footer>{{dabebase.database_name}}</template>
					<img
						src="@/assets/database/logo.jpg"
						style="width: 100%"
					/>
				</el-card>
			</div>
    </div>
  </div>
</template>

<script>
import { getDatabaseTree,} from '@/api/admin.js'
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
			flatDatabaseList:[],
    };
  },
  methods: {
			//初始化获取数据
			async getTreeData(){
				const res = await getDatabaseTree()
				this.TreeData = res.data.data
				this.flattenDatabaseData()
			},
			// 将树形结构转换为扁平结构
			flattenDatabaseData() {
				const result = [];
				
				const traverse = (node, level = 1) => {
					// 添加当前节点
					result.push({
						id: node.id,
						database_name: node.database_name,
						level: level,
						parent_id: node.parent_id,
						hasChildren: node.children && node.children.length > 0
					});
					
					// 递归处理子节点
					if (node.children && node.children.length > 0) {
						node.children.forEach(child => {
							traverse(child, level + 1);
						});
					}
				};
				
				// 处理原始数据
				this.TreeData.forEach(root => {
					traverse(root);
				});
				
				this.flatDatabaseList = result;
				// console.log(this.flatDatabaseList)
			},
			GoDatebase(dabebase){
				alert("即将进入"+dabebase.database_name)
			}
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
.container{
	min-height: 200px;
}
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px;
}
.cards .el-card {
  flex: 1 0 calc(25% - 20px); /* 每行4个，减去gap */
  min-width: 220px; /* 卡片最小宽度 */
  max-width: calc(20% - 20px); /* 确保不超过4个一行 */
}





</style>
