import React from 'react';
import { Menu, Progress, Typography, Button, Tooltip } from 'antd';
import { 
  CheckCircleFilled, 
  ClockCircleFilled, 
  MinusCircleOutlined, 
  DownloadOutlined,
  HomeOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

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
  const menuItems = sections.map((section) => {
    let icon;
    if (section.isCompleted) {
      icon = <CheckCircleFilled style={{ color: '#52c41a' }} />;
    } else if (section.key === currentSection) {
      icon = <ClockCircleFilled style={{ color: '#1890ff' }} />;
    } else {
      icon = <MinusCircleOutlined style={{ color: '#d9d9d9' }} />;
    }

    return {
      key: section.key,
      label: (
        <span style={{ fontWeight: section.key === currentSection ? 500 : 400 }}>
          {section.label}
        </span>
      ),
      icon: icon
    };
  });

  const completedCount = sections.filter(s => s.isCompleted).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Area */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid #f0f0f0' }}>
        <Title level={4} style={{ margin: '0 0 16px 0', fontSize: '18px' }}>问诊导航</Title>
        
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>完成度 ({completedCount}/{sections.length})</Text>
            <Text strong style={{ fontSize: '14px' }}>{Math.round(progress)}%</Text>
          </div>
          <Progress 
            percent={progress} 
            showInfo={false} 
            size="small" 
            strokeColor="#1890ff" 
            railColor="#f0f0f0"
          />
        </div>
      </div>

      {/* Menu Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        <Menu
          mode="inline"
          selectedKeys={[currentSection]}
          onClick={({ key }) => onSectionChange(key)}
          style={{ borderRight: 0 }}
          items={menuItems}
        />
      </div>
      
      {/* Footer Area */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
         <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 16, fontSize: '12px', color: '#8c8c8c' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircleFilled style={{ color: '#52c41a' }} /> 已完成
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleFilled style={{ color: '#1890ff' }} /> 进行中
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MinusCircleOutlined style={{ color: '#d9d9d9' }} /> 未开始
            </div>
         </div>
         
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Tooltip title="返回首页">
              <Button icon={<HomeOutlined />} onClick={onGoHome} block>首页</Button>
            </Tooltip>
            <Tooltip title="返回列表">
              <Button icon={<ArrowLeftOutlined />} onClick={onGoInterviewStart} block>列表</Button>
            </Tooltip>
         </div>
         <Button type="primary" block icon={<DownloadOutlined />} onClick={onExport} style={{ height: '40px' }}>
             生成病历
         </Button>
      </div>
    </div>
  );
};

export default NavigationPanel;
