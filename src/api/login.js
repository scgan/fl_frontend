import request from '@/utils/request'
import { convertToFormData } from '@/utils/utils'

export const userLoginService = (data) => {
  let formData = convertToFormData(data)
  return request.post('/user/login', formData)
}

export const userRoleSelect = (data) => {
  let formData = convertToFormData(data)
  return request.post('/user/role_select', formData)
}

export const userRegisterService = (data) => {
  let formData = convertToFormData(data)
  return request.post('/user/register', formData)
}

export const userGetCaptchaService = () => {
  return request.get(`/user/captcha`)
}
