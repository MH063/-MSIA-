import React from 'react';
import { Menu, Progress, Typography, Badge } from 'antd';
import { Button } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, DownloadOutlined } from '@ant-design/icons';

const { Title } = Typography;

export interface SectionStatus {
  key: string;
  label: string;
  isCompleted: boolean;
  hasError?: boolean;
}

interface NavigationPanelProps {
  currentSection: string;
  onSectionChange: (key: string) => void;
  sections: SectionStatus[];
  progress: number;
  onExport?: () => void;
  onGoHome?: () => void;
  onGoInterviewStart?: () => void;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({
  currentSection,
  onSectionChange,
  sections,
  progress,
  onExport,
  onGoHome,
  onGoInterviewStart
}) => {
  const menuItems = sections.map((section) => ({
    key: section.key,
    label: section.label,
    icon: section.hasError
      ? <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      : section.isCompleted
        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
        : <div style={{ width: 14, height: 14, border: '2px solid #d9d9d9', borderRadius: '50%', display: 'inline-block' }} />
  }));

  const completedCount = sections.filter(s => s.isCompleted).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Title level={4} style={{ margin: 0 }}>问诊导航</Title>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>完成度 ({completedCount}/{sections.length})</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress percent={progress} showInfo={false} size="small" />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        <Menu
          mode="inline"
          selectedKeys={[currentSection]}
          onClick={({ key }) => onSectionChange(key)}
          style={{ borderRight: 0 }}
          items={menuItems}
        />
      </div>
      
      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
         <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
            <Badge status="success" text="已完成" />
            <span style={{ margin: '0 8px' }}>|</span>
            <Badge status="default" text="未完成" />
         </div>
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <Button onClick={onGoHome}>返回首页</Button>
            <Button onClick={onGoInterviewStart}>返回问诊页</Button>
         </div>
         <Button type="primary" block icon={<DownloadOutlined />} onClick={onExport}>
             生成病历
         </Button>
      </div>
    </div>
  );
};

export default NavigationPanel;
