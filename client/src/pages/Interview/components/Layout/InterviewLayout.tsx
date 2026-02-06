import React from 'react';
import { Button, Grid, Layout } from 'antd';
import LazyDrawer from '../../../../components/lazy/LazyDrawer';
import { MenuOutlined } from '@ant-design/icons';

const { Sider, Content, Header } = Layout;
const { useBreakpoint } = Grid;

interface InterviewLayoutProps {
  navigation: React.ReactNode;
  editor: React.ReactNode;
  chat?: React.ReactNode;
  knowledge?: React.ReactNode | null;
}

const InterviewLayout: React.FC<InterviewLayoutProps> = ({
  navigation,
  editor,
  chat,
}) => {
  const { token } = Layout.useApp().theme.useToken();
  const screens = useBreakpoint();
  const isDesktop = Boolean(screens.md);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  if (!isDesktop) {
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
            padding: '0 12px',
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorSplit}`,
          }}
        >
          <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
          <div style={{ fontWeight: 700, color: token.colorText }}>问诊</div>
        </Header>

        <Content style={{ margin: 0, padding: 0, background: token.colorBgLayout, minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
          {/* Mobile: Chat on top (collapsible?) or Tabs? For now stack them or just show editor */}
          {chat && <div style={{ height: '40vh', borderBottom: `1px solid ${token.colorSplit}` }}>{chat}</div>}
          <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>{editor}</div>
        </Content>

        <LazyDrawer
          open={drawerOpen}
          placement="left"
          onClose={() => setDrawerOpen(false)}
          styles={{ wrapper: { width: '80vw' }, body: { padding: 0 } }}
          title={null}
        >
          <div onClick={() => setDrawerOpen(false)}>{navigation}</div>
        </LazyDrawer>
      </Layout>
    );
  }

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

      {/* Main Content Area: Split Chat and Editor */}
      <Layout style={{ marginLeft: 220, minHeight: '100vh', flexDirection: 'row' }}>
        {/* Chat Panel */}
        {chat && (
          <div style={{ 
            width: '35%', 
            minWidth: 320,
            maxWidth: 500,
            height: '100vh', 
            borderRight: `1px solid ${token.colorSplit}`,
            background: token.colorBgContainer,
            position: 'sticky',
            top: 0,
            zIndex: 5
          }}>
            {chat}
          </div>
        )}

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
};

export default InterviewLayout;
