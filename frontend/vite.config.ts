import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true }), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Component Vuetify được auto-import khi transform nên Vite không quét thấy lúc khởi động; nếu pre-bundle,
    // mỗi trang dùng component mới sẽ kích hoạt re-optimize và reload toàn trang ở lần chạy đầu.
    exclude: ['vuetify'],
  },
  server: {
    // Cookie session của Sanctum chỉ được gửi khi SPA và API cùng site: phải là localhost, không phải 127.0.0.1.
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
})
