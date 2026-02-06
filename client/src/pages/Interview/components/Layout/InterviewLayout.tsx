/**
 * 问诊页面布局组件
 * 支持响应式布局，桌面端和移动端自适应
 */

import React, { useState } from 'react';
import { Button, Grid, Layout, theme } from 'antd';
import LazyDrawer from '../../../../components/lazy/LazyDrawer';
import { MenuOutlined } from '@ant-design/icons';

const { Sider, Content, Header } = Layout;
const { useBreakpoint } = Grid;

interface InterviewLayoutProps {
  navigation: React.ReactNode;
  editor: React.ReactNode;
}

const InterviewLayout: React.FC<InterviewLayoutProps> = ({
  navigation,
  editor,
}) => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isDesktop = Boolean(screens.md);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 桌面端布局
  if (isDesktop) {
    return (
      <Layout className="interview-layout" style={{ minHeight: '100vh', background: token.colorBgLayout }}>
        {/* Left Navigation Panel */}
        <Sider
          width={220}
          theme="light"
          style={{
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            borderRight: `1px solid ${token.colorSplit}`,
            zIndex: 10,
            overflow: 'hidden',
          }}
        >
          {navigation}
        </Sider>

        {/* Main Content Area */}
        <Layout style={{ marginLeft: 220, minHeight: '100vh' }}>
          {/* Editor Panel */}
          <Content
            style={{
              flex: 1,
              margin: 0,
              padding: 20,
              background: token.colorBgLayout,
              overflowY: 'auto',
              height: '100vh',
            }}
          >
            {editor}
          </Content>
        </Layout>
      </Layout>
    );
  }

  // 移动端布局
  return (
    <Layout className="interview-layout" style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      {/* Mobile Header */}
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 12px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorSplit}`,
          height: 56,
        }}
      >
        <Button 
          type="text" 
          icon={<MenuOutlined />} 
          onClick={() => setDrawerOpen(true)}
          style={{ fontSize: 18 }}
        />
        <div style={{ fontWeight: 700, color: token.colorText, fontSize: 16, flex: 1 }}>
          问诊
        </div>
      </Header>

      {/* Mobile Content */}
      <Content style={{ 
        margin: 0, 
        padding: 12, 
        background: token.colorBgLayout, 
        minHeight: 'calc(100vh - 56px)',
      }}>
        {editor}
      </Content>

      {/* Navigation Drawer */}
      <LazyDrawer
        open={drawerOpen}
        placement="left"
        onClose={() => setDrawerOpen(false)}
        size={280}
        styles={{ body: { padding: 0 } }}
        title={null}
      >
        <div onClick={() => setDrawerOpen(false)}>{navigation}</div>
      </LazyDrawer>
    </Layout>
  );
};

export default InterviewLayout;
