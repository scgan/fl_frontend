import { createRouter, createWebHistory } from 'vue-router'

import researchRoutes, { databaseResearchRoutes } from '@/research/routes'
import adminRouter from './admin'
import uploadRouter from './upload'
import { ElMessage } from 'element-plus'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView/index.vue'),
    },
    {
      path: '/email_findpw',
      name: 'email_findpw',
      // component:findpw
      component: () =>
        import ('@/views/LoginView/FindPassword.vue')
    },
    {
      path: '/newpw',
      name: 'newpw',
      // component:newpw
      component: () =>
        import ('@/views/LoginView/NewPassword.vue')
    },
    {
      path: '/maintenance',
      redirect: '/login',
      // name: 'maintenance',
      // component: () => import('../views/Maintenance.vue')
    },
    {
      path: '/',
      // redirect: '/maintenance'
      redirect: () => {
        // console.log(to)
        // 判断用户性质，管理员或语料上传者
        if (!localStorage.getItem('token')) {
          // 如果没有token，跳转到登录页面
          return '/login'
        }
        const role = localStorage.getItem('userRole')
        if (role == '1' || role == '0') {
          // 如果是管理员
          return '/admin'
        } else {
          // 如果是语料上传者
          return {
            path: '/user',
          }
        }
      },
    },
    researchRoutes,
    databaseResearchRoutes,
    ...uploadRouter,
    ...adminRouter,
  ],
})

// 路由拦截器,防止串访？角色性质保存在浏览器的localStorage中，看要访问的路由和角色性质是否对的上
router.beforeEach(async (to, from, next) => {
  if (to.matched.some((record) => record.meta.research)) {
    if (!localStorage.getItem('token')) return next('/login')
    if (localStorage.getItem('userRole') !== '2') {
      ElMessage.warning('智能研究仅对数据收集者开放')
      return next('/')
    }
    try {
      const { useAuthStore } = await import('@/research/stores/auth')
      await useAuthStore().restore()
    } catch {
      ElMessage.error('无法验证研究会话，请重新登录或稍后重试')
      return next(false)
    }
    return next()
  }
  // 检查是否处于维护模式
  const maintenanceMode = false; // 设置为true表示开启维护模式，false表示关闭

  // 如果访问的是维护页面，直接允许
  if (to.path === '/maintenance') {
    next()
    return
  }

  // 如果开启维护模式，重定向到维护页面
  if (maintenanceMode) {
    next('/maintenance')
    return
  }

  // 获取 localStorage 中的 token 和 userRole
  const token = localStorage.getItem('token')
  const userRole = localStorage.getItem('userRole')

  // 定义路径对应的 role 规则
  const pathRoles = {
    '/user': 2, // /user 路径对应的 role 是 2
    '/admin': [0, 1], // /admin 路径对应的 role 是 0 或 1
  }

  // 获取当前路径的前半部分
  const pathPrefix = to.path.split('/')[1] // 获取路径的第一部分，如 user 或 admin
  const currentPath = `/${pathPrefix}` // 拼接成完整的路径前缀

  // console.log(currentPath)

  // 检查是否有对应的路径规则
  if (pathRoles[currentPath]) {
    // 检查是否有 token
    if (!token || !userRole) {
      // 如果没有 token，跳转到登录页面
      next({ path: '/login' })
    } else {
      // 如果有 token，检查 userRole 是否匹配
      const requiredRoles = pathRoles[currentPath]
      if (Array.isArray(requiredRoles)) {
        // 如果 requiredRoles 是数组，检查 userRole 是否在数组中
        if (requiredRoles.includes(Number(userRole))) {
          next() // 角色匹配，允许访问
        } else {
          // 权限不符不进行跳转
          ElMessage.warning('您的权限不符合此页面要求，请返回之前页面')
          next(false)
          // return false
          // next({ path: '/login' }); // 角色不匹配
        }
      } else {
        // 如果 requiredRoles 是单个值，直接比较
        if (Number(userRole) === requiredRoles) {
          next() // 角色匹配，允许访问
        } else {
          ElMessage.warning('您的权限不符合此页面要求，请返回之前页面')
          next(false)
          // return false
          // next({ path: '/login' }); // 角色不匹配
          // ElMessage.warning('您的权限不符合此页面要求')
        }
      }
    }
  } else {
    // 如果路径没有对应的规则，直接允许访问
    next()
  }
})

export default router
