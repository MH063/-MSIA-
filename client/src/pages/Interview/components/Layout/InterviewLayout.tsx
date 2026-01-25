import React from 'react';
import { Layout } from 'antd';

const { Sider, Content } = Layout;

interface InterviewLayoutProps {
  navigation: React.ReactNode;
  editor: React.ReactNode;
  knowledge: React.ReactNode;
}

const InterviewLayout: React.FC<InterviewLayoutProps> = ({
  navigation,
  editor,
  knowledge,
}) => {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Left Navigation Panel */}
      <Sider
        width={250}
        theme="light"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          borderRight: '1px solid #f0f0f0',
          zIndex: 10,
        }}
      >
        {navigation}
      </Sider>

      {/* Center Editor Panel */}
      <Layout style={{ marginLeft: 250, marginRight: 350 }}>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: '#fff',
            minHeight: 280,
            overflow: 'initial',
            borderRadius: 4,
          }}
        >
          {editor}
        </Content>
      </Layout>

      {/* Right Knowledge Panel */}
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
    </Layout>
  );
};

export default InterviewLayout;
