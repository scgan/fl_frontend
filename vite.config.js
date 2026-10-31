import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 配置代理，将跨域请求变为同域请求？
  server: {
    open: true, //启动项目自动弹出浏览器
    port: 5173, //启动端口
    proxy: {
      '/api': {
        target: 'http://10.222.9.151:9503',
        // target: 'http://127.0.0.1:5000/',	//实际请求地址
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // 研究智能体独立服务（辅助创作 / 启明问答 / 文献问答）：容器发布在 18000
      // 注意：对象字面量里重复的键会被后者覆盖，这里只保留一条，避免静默失效
      '/research-api': {
        target: 'http://10.222.9.151:18000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/research-api/, '/api/v1'),
      },
    },
  },
})
