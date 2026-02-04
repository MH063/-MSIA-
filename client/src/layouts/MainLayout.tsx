import React from 'react';
import { App as AntdApp, Button, Drawer, Grid, Layout, Menu, Space, theme } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const { Header, Content, Footer } = Layout;
const { useBreakpoint } = Grid;

const MainLayout: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const screens = useBreakpoint();
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = !screens.md;

  const items = [
    { key: '/', label: '首页' },
    { key: '/dashboard', label: '统计' },
    { key: '/interview', label: '问诊' },
    { key: '/sessions', label: '病历' },
    { key: '/knowledge', label: '知识库' },
  ];

  React.useEffect(() => {
    const p = location.pathname || '/';
    if (p.startsWith('/login')) return;
    try {
      const token = String(window.localStorage.getItem('OPERATOR_TOKEN') || '').trim();
      if (!token) {
        navigate(`/login?redirect=${encodeURIComponent(p)}`, { replace: true });
      }
    } catch {
      navigate(`/login?redirect=${encodeURIComponent(p)}`, { replace: true });
    }
  }, [location.pathname, navigate]);

  const selectedKey = React.useMemo(() => {
    const p = location.pathname || '/';
    if (p.startsWith('/login')) return '/login';
    if (p.startsWith('/interview')) return '/interview';
    if (p.startsWith('/sessions')) return '/sessions';
    if (p.startsWith('/knowledge')) return '/knowledge';
    if (p.startsWith('/dashboard')) return '/dashboard';
    return '/';
  }, [location.pathname]);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  React.useEffect(() => {
    if (screens.md) setDrawerOpen(false);
  }, [screens.md]);

  const isInterviewSession = location.pathname.startsWith('/interview/') && location.pathname !== '/interview';

  if (isInterviewSession) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: 0, margin: 0 }}>
          <Outlet />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <div className="demo-logo" style={{ color: 'white', marginRight: isMobile ? 10 : 20, fontWeight: 'bold', fontSize: isMobile ? 16 : 18 }}>MSIA</div>
        {selectedKey === '/login' ? (
          <div style={{ flex: 1 }} />
        ) : (
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
                <Drawer
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
                </Drawer>
              </>
            )}
          </>
        )}
        {selectedKey === '/login' ? null : (
          <Space style={{ marginLeft: 12 }}>
            <Button
              size="small"
              onClick={() => {
                try {
                  window.localStorage.removeItem('OPERATOR_TOKEN');
                  window.localStorage.removeItem('OPERATOR_ROLE');
                  window.localStorage.removeItem('OPERATOR_ID');
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
        )}
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
          <Outlet />
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
