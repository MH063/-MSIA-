import React from 'react';
import { Menu, Progress, Typography, Button, Tooltip, Grid, theme } from 'antd';
import { 
  HomeOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export interface SectionStatus {
  key: string;
  label: string;
  icon?: React.ReactNode;
  fallbackIcon?: React.ReactNode;
  isCompleted: boolean;
  status?: 'not_started' | 'in_progress' | 'completed';
  progress?: number;
  hasError?: boolean;
  issues?: string[];
}

interface NavigationPanelProps {
  currentSection: string;
  onSectionChange: (key: string) => void;
  sections: SectionStatus[];
  progress: number;
  onGoHome?: () => void;
  onGoInterviewStart?: () => void;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({
  currentSection,
  onSectionChange,
  sections,
  progress,
  onGoHome,
  onGoInterviewStart
}) => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const getStatusMark = (sectionKey: string, section: SectionStatus) => {
    const status = section.status || (section.isCompleted ? 'completed' : 'not_started');
    if (section.hasError) return { mark: '!', color: token.colorError };
    if (sectionKey === currentSection) return { mark: '•', color: token.colorPrimary };
    if (status === 'completed') return { mark: '✓', color: token.colorSuccess };
    if (status === 'in_progress') return { mark: '•', color: token.colorWarning };
    return { mark: '○', color: token.colorTextDisabled };
  };

  const getProgressBarColor = (prog: number): string => {
    if (prog >= 100) return token.colorSuccess;
    if (prog >= 50) return token.colorWarning;
    return token.colorError;
  };

  const menuItems = sections.map((section) => {
    const status = getStatusMark(section.key, section);
    const statusIcon = (
      <span style={{ color: status.color, fontSize: 14, display: 'inline-flex', width: 16, justifyContent: 'center' }}>
        {status.mark}
      </span>
    );

    const issuesPreview = Array.isArray(section.issues) ? section.issues.slice(0, 8) : [];
    const tooltipTitle =
      section.hasError && issuesPreview.length > 0
        ? (
          <div style={{ maxWidth: 260 }}>
            {issuesPreview.map((issue, idx) => (
              <div key={`${section.key}-${idx}`} style={{ marginBottom: idx === issuesPreview.length - 1 ? 0 : 6, lineHeight: 1.4 }}>
                • {issue}
              </div>
            ))}
            {Array.isArray(section.issues) && section.issues.length > 8 ? <div style={{ marginTop: 6 }}>……</div> : null}
          </div>
        )
        : undefined;

    const labelNode = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
        <span style={{ 
          fontWeight: section.key === currentSection ? 600 : 400,
          color: section.key === currentSection ? token.colorPrimary : token.colorText
        }}>
          {section.label}
        </span>
        {!isMobile && typeof section.progress === 'number' && (
          <div style={{ height: 3, background: token.colorFillSecondary, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: `${Math.min(100, section.progress)}%`, 
              background: getProgressBarColor(section.progress),
              transition: 'width 0.3s ease'
            }} />
          </div>
        )}
      </div>
    );

    return {
      key: section.key,
      label: (
        tooltipTitle && !isMobile ? <Tooltip title={tooltipTitle} placement="right">{labelNode}</Tooltip> : labelNode
      ),
      icon: statusIcon
    };
  });

  const completedCount = sections.filter(s => (s.status ? s.status === 'completed' : s.isCompleted)).length;

  return (
    <div 
      className="interview-nav-panel" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Header - 固定高度 */}
      <div style={{ 
        padding: isMobile ? '16px 16px' : '20px 16px 16px', 
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        flexShrink: 0,
      }}>
        <Title 
          level={isMobile ? 5 : 4} 
          style={{ 
            margin: isMobile ? '0 0 10px 0' : '0 0 12px 0', 
            fontSize: isMobile ? '16px' : '18px', 
            fontWeight: 600, 
            color: token.colorText 
          }}
        >
          问诊导航
        </Title>
        
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            {isMobile ? null : (
              <Text type="secondary" style={{ fontSize: '12px', fontWeight: 500 }}>
                完成度 ({completedCount}/{sections.length})
              </Text>
            )}
            <Text strong style={{ fontSize: '14px', color: token.colorPrimary }}>
              {Math.round(progress)}%
            </Text>
          </div>
          <Progress 
            percent={progress} 
            showInfo={false} 
            size="small" 
            strokeColor={{ '0%': '#EF4444', '30%': '#F59E0B', '70%': '#3B82F6', '100%': '#10B981' }}
            railColor={token.colorFillSecondary}
            style={{ borderRadius: 8 }}
          />
        </div>
      </div>

      {/* Menu Area - 自适应高度，可滚动 */}
      <div
        className="interview-nav-menu-area"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px 0',
          minHeight: 0,
        }}
      >
        <Menu
          mode="inline"
          selectedKeys={[currentSection]}
          onClick={({ key }) => onSectionChange(key)}
          style={{ 
            borderRight: 0,
            height: 'auto',
            minHeight: '100%',
          }}
          items={menuItems}
        />
      </div>
      
      {/* Footer - 固定高度 */}
      <div style={{ 
        padding: isMobile ? '12px 16px' : '16px', 
        borderTop: `1px solid ${token.colorBorderSecondary}`, 
        background: token.colorFillAlter,
        flexShrink: 0,
      }}>
        {isMobile ? null : (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 16, 
            marginBottom: 12, 
            fontSize: '11px', 
            color: token.colorTextSecondary 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ 
                color: token.colorSuccess, 
                width: 16, 
                height: 16, 
                borderRadius: '50%', 
                background: `${token.colorSuccess}20`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: 9,
              }}>✓</span> 已完成
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ 
                color: token.colorWarning, 
                width: 16, 
                height: 16, 
                borderRadius: '50%', 
                background: `${token.colorWarning}20`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: 9,
              }}>•</span> 进行中
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ 
                color: token.colorTextDisabled, 
                width: 16, 
                height: 16, 
                borderRadius: '50%', 
                border: `1px solid ${token.colorBorder}`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: 9,
              }}>○</span> 未开始
            </div>
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? 8 : 12 }}>
          <Tooltip title="返回首页">
            <Button 
              icon={<HomeOutlined />} 
              onClick={onGoHome} 
              block
              size="small"
              style={{ borderRadius: 6 }}
            >
              {isMobile ? null : '首页'}
            </Button>
          </Tooltip>
          <Tooltip title="返回列表">
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={onGoInterviewStart} 
              block
              size="small"
              style={{ borderRadius: 6 }}
            >
              {isMobile ? null : '列表'}
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
