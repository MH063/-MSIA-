/**
 * 智能助手浮层组件
 * 提供知识库查询、教学指导和验证功能
 */

import React, { useState } from 'react';
import { Drawer, Tabs } from 'antd';
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
  const [activeTab, setActiveTab] = useState<TabKey>('knowledge');

  const tabItems = [
    {
      key: 'knowledge' as TabKey,
      label: (
        <span>
          <BookOutlined />
          知识库
        </span>
      ),
      children: <KnowledgeTab />,
    },
    {
      key: 'validation' as TabKey,
      label: (
        <span>
          <CheckCircleOutlined />
          验证
        </span>
      ),
      children: <ValidationTab />,
    },
    {
      key: 'teaching' as TabKey,
      label: (
        <span>
          <BulbOutlined />
          教学
        </span>
      ),
      children: <TeachingTab />,
    },
  ];

  return (
    <Drawer
      title="智能助手"
      placement="right"
      onClose={onClose}
      open={open}
      size="large"
      styles={{
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
      />
    </Drawer>
  );
};

export default AssistantOverlay;
