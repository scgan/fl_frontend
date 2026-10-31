import request from '@/utils/request'
import { convertToFormData } from '../utils/utils'

export const getUserInfoService = () => {
  return request.get('/user/self')
}

export const userUpdateService = (data) => {
  let formData = convertToFormData(data)
  return request.post('/user/update', formData)
}

export const getUserAvatar = (data) => {
  return request.get(`/file/picture?user_id=${data}`, { responseType: 'blob' })
}
