/**
 * 智能助手浮层组件
 * 提供知识库查询、教学指导和验证功能
 */

import React, { useState } from 'react';
import { Drawer, Tabs, theme } from 'antd';
import { BookOutlined, CheckCircleOutlined, BulbOutlined } from '@ant-design/icons';
import KnowledgeTab from './KnowledgeTab';
import ValidationTab from './ValidationTab';
import TeachingTab from './TeachingTab';

interface AssistantOverlayProps {
  open: boolean;
  onClose: () => void;
}

type TabKey = 'knowledge' | 'validation' | 'teaching';

const AssistantOverlay: React.FC<AssistantOverlayProps> = ({
  open,
  onClose,
}) => {
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState<TabKey>('knowledge');
  const drawerSize = 'large';

  const tabItems = [
    {
      key: 'knowledge' as TabKey,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <BookOutlined />
          知识库
        </span>
      ),
      children: <KnowledgeTab />,
    },
    {
      key: 'validation' as TabKey,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <CheckCircleOutlined />
          验证
        </span>
      ),
      children: <ValidationTab />,
    },
    {
      key: 'teaching' as TabKey,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <BulbOutlined />
          教学
        </span>
      ),
      children: <TeachingTab />,
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10, 
          fontSize: 16, 
          fontWeight: 600,
          color: token.colorText,
        }}>
          <span style={{ 
            background: 'var(--msia-primary-gradient)', 
            width: 28, 
            height: 28, 
            borderRadius: 8, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#fff',
            fontSize: 14,
          }}>
            <BulbOutlined />
          </span>
          智能助手
        </div>
      }
      placement="right"
      onClose={onClose}
      open={open}
      size={drawerSize}
      styles={{
        header: {
          padding: '16px 20px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        },
        body: {
          padding: 0,
        },
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
        items={tabItems}
        style={{ padding: '0 16px' }}
        tabBarStyle={{
          marginBottom: 16,
          fontWeight: 500,
        }}
      />
    </Drawer>
  );
};

export default AssistantOverlay;
