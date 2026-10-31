<template>
  <div class="maintenance-container">
    <div class="maintenance-content">
      <div class="maintenance-icon">
        <i class="el-icon-warning"></i>
      </div>
      <h1 class="maintenance-title">系统维护中</h1>
      <p class="maintenance-message">
        我们正在进行系统维护和升级<br>
        暂时无法提供服务<br><br>
        请您稍后再试，谢谢您的理解与配合！
      </p>
      <div class="maintenance-contact">
        <p>如有紧急问题，请联系管理员</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Maintenance'
}
</script>

<style scoped>
.maintenance-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.maintenance-content {
  text-align: center;
  padding: 40px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 80%;
}

.maintenance-icon {
  font-size: 64px;
  color: #e6a23c;
  margin-bottom: 20px;
}

.maintenance-title {
  font-size: 28px;
  color: #303133;
  margin: 20px 0;
}

.maintenance-message {
  font-size: 16px;
  color: #606266;
  line-height: 1.6;
  margin: 20px 0;
}

.maintenance-contact {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #dcdfe6;
  color: #909399;
}
</style>