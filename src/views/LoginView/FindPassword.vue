<template>
<div class="fatherContainer">
  <button class="toLogin" @click="toLogin">首页</button>
  <el-card class="login-card">
    <div class="clearfix" style="text-align: center;">
      <span class="titletext">通过邮箱找回密码</span>
      <!-- <span class="changeWay" @click="changeWay()">换一种方式<i class="el-icon-arrow-right"></i></span> -->
    </div>
    <el-form ref="form" :model="form" label-width="" :rules="rules" style="margin-top: 40px;">
      <el-form-item label="邮     箱: " prop="email_pw" style="width: 100%; padding-left:20%">
        <el-input v-model="form.email_pw" autocomplete="off" style="width: 50%;" />
      </el-form-item>

      <!-- <el-form-item style="width: 100%; text-align: center;">
        <div class="center-box">
          <el-button type="primary" @click="onSubmit('form')" style="margin-right: 40px;">发送邮件</el-button>
        </div>
      </el-form-item> -->
    </el-form>
      <div class="center-box">
        <el-button type="primary" @click="onSubmit('form')">发送邮件</el-button>
      </div>
    <hr>
    <div style="margin-left: 9%; width: 82%; margin-top: 16px;">
      <span style="font-size:15px ;color:red">如需找回密码，请输入您的注册邮箱，点击【发送邮件】，系统将发送密码找回邮件至您的邮箱（邮件有可能被拦截为广告或垃圾邮件），请根据邮件提示找回密码，密码修改成功后请妥善保管。</span>
    </div>
  </el-card>

  </div>
</template>
<script>

export default {
  data() {
    return {
      readonly: true,
      form: {
        email_pw: ''
      },
      rules: {
        email_pw: [
          { required: true, message: '请填写邮箱', trigger: 'blur' },
          { type: 'email', message: '请输入正确的邮箱地址', trigger: ['blur', 'change'] }
        ],
      }
    }
  },

  methods: {
    // 点击跳回首页
    toLogin() {
        this.$router.push({path: '/'});
    },
    // 切换找回密码方式
    changeWay() {
      this.$router.push({path: '/findpw', query:{origin: this.$route.query.origin} });
    },
    // back() {
    //   this.$router.back(-1)
    // },
    onSubmit(form) {
      // this.$alert('如您填写的是163邮箱，因为其系统限制，请于30分钟后登陆邮箱查看找回邮件。', '提示', {
			//   confirmButtonText: '确定'
      // }).then(
        this.$refs[form].validate(valid => {
          const data = {
            email: this.form.email_pw,
            // OrganizationId: this.form.organizationId_pw
          }
          if (valid) {
            fetch(`/api/user/forget_password`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            }).then(res => {
              if (res.ok) {
                this.$alert('重置密码的邮件已发送到邮箱，请注意查收邮件', {
                }).then(() => {
                  this.$router.push({ path: '/' })
                })
              }else if(res.status==400){
                res.json().then(val=>{
                  this.$alert(val.message, {confirmButtonText:'确定'})
                })
              }else{
                this.$alert('服务器错误', {confirmButtonText:'确定'})
              }
            })
          } else {
            this.$alert('请填写完整信息', {
              confirmButtonText: '确定'
            })
          }
        })
      // )
    }
  }
}
</script>
<style scoped>
.center-box {
  display: flex;
  justify-content: center;   /* 水平居中 */
}
.fatherContainer{
  width:100%;
  height: 100vh;
  position: relative;
  background: #f2f4f6;
  /* 与平台一致的深青主题 */
  --el-color-primary: #005767;
  --el-color-primary-light-3: #33798a;
  --el-color-primary-light-5: #66a0ac;
  --el-color-primary-light-7: #99c1c8;
  --el-color-primary-light-8: #cce0e4;
  --el-color-primary-light-9: #eef4f5;
  --el-color-primary-dark-2: #004a56;
  --el-border-radius-base: 8px;
}
.toLogin {
  position: absolute;
  top: calc(25% - 20px);
  left: calc(75% - 60px);
  width: 60px;
  height: 20px;
  border: none;
}
 .login-card {
   position: absolute;
    width: 50%;
    /* margin-left: 500px; */
    margin:0 auto;
    top:25%;
    left:25%;
  }
.login-card .clearfix {
    font-family: Microsoft YaHei;
    color: #143437;
}
.titletext {
    font-weight:bolder;
    font-size: 28px;
}
.changeWay {
    font-size: 18px;
    margin-left: 20px;
}
.el-form-item__label{
  padding: 0px;
  width: 90px
}
.el-form-item__content{
  margin: 0 !important;
}
.el-input /deep/ .el-input__inner{
  height: 32px;
}
</style>

<style>
.message-login{
  width: 500px;
  height: 200px;
  /* line-height: 300px; */
  margin-top: 60px;
  /* font-size: 30px; */
  /* color: red; */
}
/* .el-message-box__message{
  color: red;
} */
</style>
