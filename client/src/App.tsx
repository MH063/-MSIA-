import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import router from './router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useThemeStore } from './store/theme.store';

const queryClient = new QueryClient();

const App: React.FC = () => {
  const { mode } = useThemeStore();

  useEffect(() => {
    // Apply theme to body for global CSS variables
    document.body.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: mode === 'dark' ? '#4582E6' : '#0052D9',
          colorSuccess: mode === 'dark' ? '#298E64' : '#2BA471',
          borderRadius: 6,
          fontFamily:
            "'PingFang SC', Roboto, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
          colorBgContainer: mode === 'dark' ? '#1F1F1F' : '#ffffff',
          colorBgLayout: mode === 'dark' ? '#141414' : '#F5F7FA',
        },
      }}
    >
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
