import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8000,
    host: '0.0.0.0',
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
          query: ['@tanstack/react-query'],
          state: ['zustand'],
          // 移除 rehype-raw，减少懒加载块体积
          // 实际按需加载由 LazyMarkdown 控制
          markdown: ['react-markdown', 'remark-gfm'],
          viz: ['d3', 'echarts'],
          vendor: ['axios', 'dayjs'],
        },
      },
    },
  },
})
