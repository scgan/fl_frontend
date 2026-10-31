import axios from 'axios'
import router from '@/router'

const baseURL = '/api'

const silentUrlPrefixes = ['/file/picture', '/file/corpus', '/public/file/corpus']

function isSilentUrl(url) {
  return silentUrlPrefixes.some((prefix) => url.startsWith(prefix))
}

// 是否不弹错误提示：整段 URL 静默，或单次请求传了 { silent: true }（由调用方自己提示错误）
function isSilentRequest(config, url) {
  if (config?.silent) return true
  return url ? isSilentUrl(url) : false
}

const instance = axios.create({
  // TODO 1. 基础地址，超时时间
  baseURL,
  timeout: 10000 * 6 * 5,
})

//请求拦截器
instance.interceptors.request.use(
  (config) => {
    // TODO 2. 携带token
    if (localStorage.getItem('token')) {
      config.headers.Authorization = 'Bearer ' + localStorage.getItem('token')
      // console.log(config.headers.Authorization)
    }
    return config
  },
  (err) => Promise.reject(err),
)

//响应拦截器
instance.interceptors.response.use(
  (res) => {
    // TODO 3. 处理业务失败
    // TODO 4. 摘取核心响应数据
    // return res
    // 如果返回值没有 code 或 code 为 200/202，则认为成功
    if (!Object.prototype.hasOwnProperty.call(res.data, 'code') || res.data.code === 200 || res.data.code === 202) {
      return res
    }
    // // console.log(res.data.message)
    if (!isSilentRequest(res.config)) ElMessage.error(res.data.error || '服务器繁忙')
    return Promise.reject(res.data)
  },
  (err) => {
    // TODO 5. 处理401错误
    //401权限不足或token过期
    if (err.response?.status === 401) {
      router.push('/login')
      localStorage.removeItem('token')
      localStorage.removeItem('userRole')
    }

    if (!isSilentRequest(err.config, err.response?.config.url))
      ElMessage.error(err.response?.data?.error || '服务器繁忙')
    return Promise.reject(err)
  },
)

export default instance
export { baseURL }
