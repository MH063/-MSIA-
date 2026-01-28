import React from 'react';
import { Layout, Menu, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import FloatingAssistantButton from '../components/FloatingAssistantButton';

const { Header, Content, Footer } = Layout;

const MainLayout: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { key: '/', label: '首页' },
    { key: '/interview', label: '问诊' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <div className="demo-logo" style={{ color: 'white', marginRight: '20px', fontWeight: 'bold', fontSize: '18px' }}>MSIA</div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={(e) => navigate(e.key)}
          style={{ flex: 1, minWidth: 0 }}
        />
      </Header>
      <Content style={{ padding: '0 48px', marginTop: '24px' }}>
        <div
          style={{
            background: colorBgContainer,
            minHeight: 280,
            padding: 24,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        MSIA ©{new Date().getFullYear()} Created by Trae AI
      </Footer>
      <FloatingAssistantButton
        status="default"
        iconVariant="robot"
        currentLabel="一般项目"
        progressPercent={25}
        onClick={() => {
          // 关键日志
          console.log('[浮动按钮] 触发全局点击');
        }}
      />
    </Layout>
  );
};

export default MainLayout;
