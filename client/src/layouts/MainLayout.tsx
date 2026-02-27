import React from 'react';
import { App as AntdApp, Button, Grid, Layout, Menu, Space, theme } from 'antd';
import LazyDrawer from '../components/lazy/LazyDrawer';
import { MenuOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import { useThemeStore } from '../store/theme.store';
import logger from '../utils/logger';
import api from '../utils/api';

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

  const [authChecking, setAuthChecking] = React.useState(false);
  const hasCheckedAuth = React.useRef(false);

  const items = [
    { key: '/home', label: '首页' },
    { key: '/dashboard', label: '统计' },
    { key: '/interview', label: '问诊' },
    { key: '/sessions', label: '病历' },
    { key: '/knowledge', label: '知识库' },
  ];

  React.useEffect(() => {
    if (hasCheckedAuth.current) return;

    const p = location.pathname || '/';
    const noAuthCheck = p === '/'
      || p.startsWith('/login')
      || p.startsWith('/register')
      || p === '/home'
      || p === '/dashboard'
      || p === '/interview'
      || p === '/sessions'
      || p === '/knowledge'
      || p === '/interview/new';
    if (noAuthCheck) {
      setAuthChecking(false);
      hasCheckedAuth.current = true;
      return;
    }

    hasCheckedAuth.current = true;
    setAuthChecking(true);

    (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${import.meta.env.PROD ? '' : `http://${window.location.hostname}:4000`}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 401) {
          navigate(`/login?redirect=${encodeURIComponent(p)}`, { replace: true });
        } else if (response.ok) {
          const data = await response.json();
          if (!data?.success || !data?.data) {
            navigate(`/login?redirect=${encodeURIComponent(p)}`, { replace: true });
          }
        } else {
          navigate(`/login?redirect=${encodeURIComponent(p)}`, { replace: true });
        }
      } catch {
        navigate(`/login?redirect=${encodeURIComponent(p)}`, { replace: true });
      } finally {
        setAuthChecking(false);
      }
    })();
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
