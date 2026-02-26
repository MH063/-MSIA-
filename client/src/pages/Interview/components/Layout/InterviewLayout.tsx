/**
 * 问诊页面布局组件
 * 支持响应式布局，桌面端和移动端自适应
 * 左侧固定导航 + 右侧可滚动内容
 */

import React, { useState, useCallback } from 'react';
import { Button, Grid, Layout, theme } from 'antd';
import LazyDrawer from '../../../../components/lazy/LazyDrawer';
import { MenuOutlined } from '@ant-design/icons';

const { Content, Header } = Layout;
const { useBreakpoint } = Grid;

interface InterviewLayoutProps {
  navigation: React.ReactNode;
  editor: React.ReactNode;
  onMobileNavigationChange?: () => void;
}

const InterviewLayout: React.FC<InterviewLayoutProps> = ({
  navigation,
  editor,
  onMobileNavigationChange,
}) => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isDesktop = Boolean(screens.md);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    if (onMobileNavigationChange) {
      setTimeout(() => {
        onMobileNavigationChange();
      }, 300);
    }
  }, [onMobileNavigationChange]);

  // 桌面端布局 - 左侧固定导航 + 右侧可滚动内容 (Admin Dashboard Layout Pattern)
  if (isDesktop) {
    return (
      <div 
        className="interview-layout" 
        style={{ 
          display: 'flex',
          height: '100vh', // 视口高度
          overflow: 'hidden', // 防止body滚动
          background: token.colorBgLayout 
        }}
      >
        {/* 左侧固定导航面板 */}

        <aside
          className="interview-sider"
          style={{
            width: 280, // 稍微加宽一点，更美观
            flexShrink: 0,
            height: '100%',
            borderRight: `1px solid ${token.colorSplit}`,
            zIndex: 10,
            background: token.colorBgContainer,
            boxShadow: '4px 0 24px rgba(0,0,0,0.08)', // 更柔和的阴影
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative', // 相对定位，不需要 fixed，因为父容器是 flex
          }}
        >
          {navigation}
        </aside>

        {/* 右侧内容区域 - 独立滚动 */}
        <main
          style={{
            flex: 1,
            height: '100%',
            overflowY: 'auto', // 独立滚动
            overflowX: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              flex: 1,
              padding: '24px 32px', // 增加内边距
              maxWidth: 1200, // 限制最大宽度，提升阅读体验
              margin: '0 auto', // 居中
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {editor}
          </div>
        </main>
      </div>
    );
  }

  // 移动端布局
  return (
    <Layout className="interview-layout" style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorSplit}`,
          height: 56,
          boxShadow: 'var(--msia-shadow-sm)',
        }}
      >
        <Button 
          type="text" 
          icon={<MenuOutlined />} 
          onClick={() => setDrawerOpen(true)}
          style={{ fontSize: 18, borderRadius: 8 }}
        />
        <div style={{ fontWeight: 600, color: token.colorText, fontSize: 16, flex: 1, letterSpacing: 0.3 }}>
          问诊
        </div>
      </Header>

      <Content style={{ 
        margin: 0, 
        padding: 16, 
        background: token.colorBgLayout, 
        minHeight: 'calc(100vh - 56px)',
      }}>
        {editor}
      </Content>

      <LazyDrawer
        open={drawerOpen}
        placement="left"
        onClose={handleDrawerClose}
        size={280}
        styles={{ 
          body: { padding: 0 },
          header: { display: 'none' },
        }}
        title={null}
        afterOpenChange={(open) => {
          if (!open && onMobileNavigationChange) {
            onMobileNavigationChange();
          }
        }}
      >
        <div style={{ height: '100%' }}>{navigation}</div>
      </LazyDrawer>
    </Layout>
  );
};

export default InterviewLayout;
