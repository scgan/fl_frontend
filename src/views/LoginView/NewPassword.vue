<template>
  <el-card class="login-card">
    <div class="clearfix">
      <span>请更新您的密码</span>
    </div>
    <el-form ref="form" :model="form" label-width="100px" :rules="rules">
      <el-form-item label="新密码: " prop="password" style="width: 100%;padding-left:60px">
        <el-input v-model="form.password" style="width: 80%" type="password" show-password />
      </el-form-item>
      <el-form-item label="确认密码" prop="checkpassword" style="width: 100%;padding-left:60px">
        <el-input
          v-model="form.checkpassword"
          type="password"
          show-password
          style="width: 80%"
          autocomplete="off"
        />
      </el-form-item>

      <el-form-item style="width: 96%;padding-left:160px">
        <el-button type="primary" @click="onSubmit('form')">修改</el-button>
        <el-button type="primary" @click="back">取消</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script>
export default {
  data() {
    var validatePass2 = (rule, value, callback) => {
      if (value === '') {
        callback(new Error('请再次输入密码'))
      } else if (value !== this.form.password) {
        callback(new Error('两次输入密码不一致!'))
      } else {
        callback()
      }
    }
    return {
      form: {
        password: '',
        checkpassword: ''
      },
      urlForm: {
        Email: '',
        Token: '',
        Expire: '',
        T: ''
      },
      rules: {
        password: [
          { required: true, message: '请输入密码', trigger: 'blur' },
          {
            min: 8,
            message: '密码长度不能小于8位',
            trigger: 'blur',
          },
          {
            validator: (rule, value, callback) => {
              const passwordRegex =
                /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#\$%\^&\*\(\)\-_=+\[\]{};':"\\|,.<>\/?`~])[A-Za-z\d!@#\$%\^&\*\(\)\-_=+\[\]{};':"\\|,.<>\/?`~]{8,}$/
              if (!passwordRegex.test(value)) {
                callback(new Error('密码必须包含大小写字母、数字和特殊字符'))
              } else {
                callback()
              }
            },
            trigger: 'blur',
          },
        ],
        checkpassword: [
          { validator: validatePass2, trigger: 'blur' }
        ]
      }
    }
  },
  mounted() {
    console.log(this)
    this.urlForm.Email = this.GetKeyToValue('Email')
    this.urlForm.Token = this.GetKeyToValue('Token')
    this.urlForm.Expire = this.GetKeyToValue('Expire')
    this.urlForm.T = this.GetKeyToValue('T')
    console.log(JSON.stringify(this.urlForm))
  },
  methods: {
    // GetKeyToValue(name){
    //     var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)")
    //     var r = window.location.search.substr(1).match(reg)
    //     if (r != null) return unescape(r[2]); return null;
    // },
    GetKeyToValue(name) {
      var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)', 'i')
      // console.log(window.location.href)
      var localurl = decodeURIComponent(window.location.search)
      // console.log(localurl)
      var r = localurl.substr(1).match(reg)
      // console.log(r)
      if (r != null) return unescape(r[2]); return null
    },
    back() {
      this.$router.back(-1)
    },
    onSubmit(form) {
      this.$refs[form].validate(valid => {
        const data = {
          email: this.urlForm.Email,
          token: this.urlForm.Token,
          new_password: this.form.password,
          expire: this.urlForm.Expire,
          t: this.urlForm.T
        }
        if (valid) {
          fetch(`/api/user/reset_password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          }).then(res => {
            if (res.ok) {
              this.$alert('修改成功', {
                confirmButtonText: '确定'
              }).then(() => {
                this.$router.push({ path: `/alylogin` })
              })
            } else {
              this.$alert('修改失败', {
                confirmButtonText: '确定'
              })
            }
          })
        } else {
          this.$alert('请填写信息', {
            confirmButtonText: '确定'
          })
        }
      })
    }

  }
}
</script>
<style scoped>
 .login-card {
    width: 850px;
    /* margin-left: 500px; */
    margin:0 auto;
  }
.el-form-item__label{
  padding: 0px;
  width: 90px
}
</style>
