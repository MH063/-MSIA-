import React from 'react';
import { Layout } from 'antd';

const { Sider, Content } = Layout;

interface InterviewLayoutProps {
  navigation: React.ReactNode;
  editor: React.ReactNode;
  knowledge?: React.ReactNode | null;
}

const InterviewLayout: React.FC<InterviewLayoutProps> = ({
  navigation,
  editor,
}) => {
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
