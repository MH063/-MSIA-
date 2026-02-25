import React from 'react';
import { App as AntdApp, Button, Grid, Layout, Menu, Space, theme } from 'antd';
import Loader from '../components/common/Loader';
import LazyDrawer from '../components/lazy/LazyDrawer';
import { MenuOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import api, { unwrapData } from '../utils/api';
import type { ApiResponse } from '../utils/api';
import Logo from '../components/Logo';
import { useThemeStore } from '../store/theme.store';
import logger from '../utils/logger';

const { Header, Content, Footer } = Layout;
const { useBreakpoint } = Grid;

const MainLayout: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const { mode, toggleTheme } = useThemeStore();
  const screens = useBreakpoint();
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = !screens.md;
  const [appLoading, setAppLoading] = React.useState(() => {
    const p = location.pathname || '/';
    const noLoader = p === '/'
      || p.startsWith('/login')
      || p.startsWith('/register')
      || p === '/home'
      || p === '/dashboard'
      || p === '/interview'
      || p === '/sessions'
      || p === '/knowledge'
      || p === '/interview/new';
    return !noLoader;
  });
  const [loadingProgress, setLoadingProgress] = React.useState(() => (appLoading ? 0 : 100));
  const [authChecking, setAuthChecking] = React.useState(false);

  const items = [
    { key: '/home', label: '首页' },
    { key: '/dashboard', label: '统计' },
    { key: '/interview', label: '问诊' },
    { key: '/sessions', label: '病历' },
    { key: '/knowledge', label: '知识库' },
  ];

  React.useEffect(() => {
    const p = location.pathname || '/';
    const noLoader = p === '/'
      || p.startsWith('/login')
      || p.startsWith('/register')
      || p === '/home'
      || p === '/dashboard'
      || p === '/interview'
      || p === '/sessions'
      || p === '/knowledge'
      || p === '/interview/new';
    if (noLoader) {
      setAppLoading(false);
      setLoadingProgress(100);
      setAuthChecking(false);
      return;
    }
    
    // Initial progress
    setAppLoading(true);
    setLoadingProgress(0);
    
    let alive = true;
    setAuthChecking(true);
    
    (async () => {
      try {
        setLoadingProgress(10);
        // Wait for a small delay to simulate initial connection
        await new Promise(r => setTimeout(r, 100));
        
        setLoadingProgress(30);
        const res = (await api.get('/auth/me')) as ApiResponse<
          { operatorId: number; role: 'admin' | 'doctor'; name?: string } | { data: { operatorId: number; role: 'admin' | 'doctor'; name?: string } }
        >;
        
        if (!alive) return;
        setLoadingProgress(70);
        
        const payload = unwrapData<{ operatorId: number; role: 'admin' | 'doctor'; name?: string }>(res);
        
        setLoadingProgress(90);
        
        if (!res?.success || !payload) {
          navigate(`/login?redirect=${encodeURIComponent(p)}`, { replace: true });
        } else {
          // Success
          setLoadingProgress(100);
          // Wait a bit to show 100%
          setTimeout(() => {
            if (alive) setAppLoading(false);
          }, 500);
        }
      } catch {
        if (!alive) return;
        setLoadingProgress(100);
        setTimeout(() => {
           navigate(`/login?redirect=${encodeURIComponent(p)}`, { replace: true });
           if (alive) setAppLoading(false);
        }, 500);
      } finally {
        if (alive) setAuthChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [location.pathname, navigate]);

  const selectedKey = React.useMemo(() => {
    const p = location.pathname || '/';
    if (p === '/' || p.startsWith('/login') || p.startsWith('/register')) return '/login';
    if (p.startsWith('/interview')) return '/interview';
    if (p.startsWith('/sessions')) return '/sessions';
    if (p.startsWith('/knowledge')) return '/knowledge';
    if (p.startsWith('/dashboard')) return '/dashboard';
    if (p.startsWith('/home')) return '/home';
    return '/home';
  }, [location.pathname]);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  React.useEffect(() => {
    if (screens.md) setDrawerOpen(false);
  }, [screens.md]);

  const isInterviewSession = location.pathname.startsWith('/interview/') && location.pathname !== '/interview';
  const isLogin = React.useMemo(() => selectedKey === '/login', [selectedKey]);

  if (appLoading) {
    return <Loader fullscreen percent={loadingProgress} />;
  }

  if (isInterviewSession) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 0, margin: 0 }}>
          <Outlet />
        </Content>
      </Layout>
    );
  }

  if (isLogin) {
    return (
      <Layout style={{ height: '100dvh', minHeight: '100dvh' }}>
        <Content style={{ padding: 0, margin: 0, height: '100%', display: 'grid', placeItems: 'center' }}>
          <Outlet />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <div className="demo-logo" style={{ display: 'flex', alignItems: 'center', marginRight: isMobile ? 10 : 20 }}>
          <Logo width={isMobile ? 36 : 44} height={isMobile ? 36 : 44} />
        </div>
        <>
          {screens.md ? (
            <Menu
              theme="dark"
              mode="horizontal"
              selectedKeys={[selectedKey]}
              items={items}
              onClick={(e) => navigate(e.key)}
              style={{ flex: 1, minWidth: 0 }}
            />
          ) : (
            <>
              <Button
                type="text"
                icon={<MenuOutlined style={{ color: '#fff' }} />}
                onClick={() => setDrawerOpen(true)}
              />
              <div style={{ flex: 1 }} />
              <LazyDrawer
                title="导航"
                placement="left"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                styles={{ body: { padding: 0 } }}
              >
                <Menu
                  mode="inline"
                  selectedKeys={[selectedKey]}
                  items={items}
                  onClick={(e) => {
                    setDrawerOpen(false);
                    navigate(e.key);
                  }}
                />
              </LazyDrawer>
            </>
          )}
        </>
        <Space style={{ marginLeft: 12 }}>
          <Button
            type="text"
            icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            style={{ color: '#fff' }}
          />
          <Button
            size="small"
            onClick={async () => {
              try {
                await api.post('/auth/logout');
              } catch (e) {
                logger.warn('[MainLayout] 退出登录接口调用失败', e);
              }
              try {
                window.localStorage.removeItem('OPERATOR_ROLE');
                window.localStorage.removeItem('OPERATOR_ID');
                window.localStorage.removeItem('OPERATOR_NAME');
              } catch {
                // ignore
              }
              message.success('已退出登录');
              navigate('/login', { replace: true });
            }}
          >
            退出
          </Button>
        </Space>
      </Header>
      <Content style={{ padding: screens.md ? '0 48px' : '0 10px', marginTop: isMobile ? 12 : 16 }}>
        <div
          style={{
            background: colorBgContainer,
            minHeight: 280,
            padding: screens.md ? 24 : 12,
            borderRadius: borderRadiusLG,
          }}
        >
          {authChecking ? null : <Outlet />}
        </div>
      </Content>
      {isMobile ? null : (
        <Footer style={{ textAlign: 'center' }}>
          MSIA ©{new Date().getFullYear()} Created by Trae AI
        </Footer>
      )}
    </Layout>
  );
};

export default MainLayout;
