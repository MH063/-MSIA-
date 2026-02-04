import React from 'react';
import { Button, Drawer, Grid, Layout } from 'antd';
import { MenuOutlined } from '@ant-design/icons';

const { Sider, Content, Header } = Layout;
const { useBreakpoint } = Grid;

interface InterviewLayoutProps {
  navigation: React.ReactNode;
  editor: React.ReactNode;
  knowledge?: React.ReactNode | null;
}

const InterviewLayout: React.FC<InterviewLayoutProps> = ({
  navigation,
  editor,
}) => {
  const screens = useBreakpoint();
  const isDesktop = Boolean(screens.md);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  if (!isDesktop) {
    return (
      <Layout className="interview-layout" style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 12px',
            background: '#ffffff',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
          <div style={{ fontWeight: 700, color: '#1f1f1f' }}>问诊</div>
        </Header>

        <Content style={{ margin: 0, padding: 12, background: '#f0f2f5', minHeight: 'calc(100vh - 64px)' }}>
          {editor}
        </Content>

        <Drawer
          open={drawerOpen}
          placement="left"
          onClose={() => setDrawerOpen(false)}
          styles={{ wrapper: { width: '100vw' }, body: { padding: 0 } }}
          title={null}
        >
          <div onClick={() => setDrawerOpen(false)}>{navigation}</div>
        </Drawer>
      </Layout>
    );
  }

  return (
    <Layout className="interview-layout" style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Left Navigation Panel */}
      <Sider
        width={280}
        theme="light"
        style={{
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          borderRight: '1px solid #f0f0f0',
          zIndex: 10,
          overflow: 'hidden',
        }}
      >
        {navigation}
      </Sider>

      {/* Center Editor Panel - 知识库已集成到智能问诊助手，此处占满右侧空间 */}
      <Layout style={{ marginLeft: 280, minHeight: '100vh' }}>
        <Content
          style={{
            margin: 0,
            padding: 20,
            background: '#f0f2f5',
            overflowY: 'auto',
            minHeight: '100vh',
          }}
        >
          {editor}
        </Content>
      </Layout>

      {/* Knowledge Panel - 已移除固定右侧面板，知识库内容集成到智能问诊助手Drawer中 */}
      {/* 原有的右侧Sider已移除，如果需要恢复，可参考以下代码： */}
      {/* {knowledge && (
        <Sider
          width={350}
          theme="light"
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            borderLeft: '1px solid #f0f0f0',
            zIndex: 10,
          }}
        >
          {knowledge}
        </Sider>
      )} */}
    </Layout>
  );
};

export default InterviewLayout;
