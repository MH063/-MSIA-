import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker, captureInstallPrompt } from './utils/serviceWorker'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 注册 Service Worker（仅在生产环境）
if (import.meta.env.PROD) {
  registerServiceWorker({
    onUpdate: (registration) => {
      // 有新版本可用，可以提示用户刷新
      
      // 可选：显示更新提示
      if (window.confirm('有新版本可用，是否立即更新？')) {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    },
    onSuccess: () => {
      
    },
    onOffline: () => {
      
    },
    onOnline: () => {
      
    },
  });

  // 捕获 PWA 安装提示
  captureInstallPrompt();
}
