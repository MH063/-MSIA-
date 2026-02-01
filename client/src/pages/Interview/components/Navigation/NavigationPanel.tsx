import React from 'react';
import { Menu, Progress, Typography, Button, Tooltip } from 'antd';
import { 
  HomeOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

export interface SectionStatus {
  key: string;
  label: string;
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
  const menuWrapRef = React.useRef<HTMLDivElement | null>(null);
  const hideScrollbarTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrollable, setIsScrollable] = React.useState(false);
  const [scrollbarVisible, setScrollbarVisible] = React.useState(false);
  const [thumbStyle, setThumbStyle] = React.useState<{ height: number; y: number }>({ height: 0, y: 0 });

  const updateScrollable = React.useCallback(() => {
    const el = menuWrapRef.current;
    if (!el) return;
    const next = el.scrollHeight - el.clientHeight > 2;
    setIsScrollable(prev => (prev === next ? prev : next));
    if (!next) setScrollbarVisible(false);
  }, []);

  const updateThumb = React.useCallback(() => {
    const el = menuWrapRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
    if (maxScrollTop <= 0 || clientHeight <= 0) {
      setThumbStyle({ height: 0, y: 0 });
      return;
    }
    const ratio = clientHeight / scrollHeight;
    const minHeight = 24;
    const height = Math.max(minHeight, Math.floor(clientHeight * ratio));
    const track = Math.max(1, clientHeight - height);
    const y = Math.floor((scrollTop / maxScrollTop) * track);
    setThumbStyle(prev => (prev.height === height && prev.y === y ? prev : { height, y }));
  }, []);

  const showScrollbarTemporarily = React.useCallback((delayMs: number) => {
    if (!isScrollable) return;
    setScrollbarVisible(true);
    if (hideScrollbarTimerRef.current) clearTimeout(hideScrollbarTimerRef.current);
    hideScrollbarTimerRef.current = setTimeout(() => {
      setScrollbarVisible(false);
    }, delayMs);
  }, [isScrollable]);

  React.useLayoutEffect(() => {
    updateScrollable();
    updateThumb();
  }, [updateScrollable, updateThumb, sections]);

  React.useEffect(() => {
    updateScrollable();
    updateThumb();
  }, [updateScrollable, updateThumb, currentSection, sections, progress]);

  React.useEffect(() => {
    const el = menuWrapRef.current;
    if (!el) return;

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        updateScrollable();
        updateThumb();
      });
      ro.observe(el);
      const menu = el.querySelector('.ant-menu');
      if (menu) ro.observe(menu);
      return () => ro.disconnect();
    }

    const t = setInterval(() => {
      updateScrollable();
      updateThumb();
    }, 500);
    return () => clearInterval(t);
  }, [updateScrollable, updateThumb]);

  React.useEffect(() => {
    return () => {
      if (hideScrollbarTimerRef.current) clearTimeout(hideScrollbarTimerRef.current);
    };
  }, []);

  const getStatusMark = (sectionKey: string, section: SectionStatus) => {
    const status = section.status || (section.isCompleted ? 'completed' : 'not_started');
    if (section.hasError) return { mark: '!', color: '#1677ff' };
    if (sectionKey === currentSection) return { mark: '•', color: '#1890ff' };
    if (status === 'completed') return { mark: '✓', color: '#52c41a' };
    if (status === 'in_progress') return { mark: '•', color: '#faad14' };
    return { mark: '○', color: '#bfbfbf' };
  };

  const menuItems = sections.map((section) => {
    const status = getStatusMark(section.key, section);
    const icon = (
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

    return {
      key: section.key,
      label: (
        <Tooltip title={tooltipTitle} placement="right">
          <span style={{ fontWeight: section.key === currentSection ? 500 : 400 }}>
            {section.label}
          </span>
        </Tooltip>
      ),
      icon: icon
    };
  });

  const completedCount = sections.filter(s => (s.status ? s.status === 'completed' : s.isCompleted)).length;

  return (
    <div className="interview-nav-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
            strokeColor={{ '0%': '#ff4d4f', '50%': '#faad14', '100%': '#52c41a' }}
            railColor="#f0f0f0"
          />
        </div>
      </div>

      {/* Menu Area */}
      <div
        ref={menuWrapRef}
        className={[
          'interview-nav-menu-area',
          isScrollable ? 'is-scrollable' : 'not-scrollable',
          scrollbarVisible ? 'scrollbar-visible' : 'scrollbar-hidden',
        ].join(' ')}
        onMouseEnter={() => {
          if (!isScrollable) return;
          if (hideScrollbarTimerRef.current) clearTimeout(hideScrollbarTimerRef.current);
          setScrollbarVisible(true);
        }}
        onMouseLeave={() => showScrollbarTemporarily(240)}
        onScroll={() => {
          updateThumb();
          showScrollbarTemporarily(900);
        }}
        onWheel={() => showScrollbarTemporarily(900)}
        onKeyDown={() => showScrollbarTemporarily(900)}
        onFocusCapture={() => showScrollbarTemporarily(900)}
      >
        <Menu
          mode="inline"
          selectedKeys={[currentSection]}
          onClick={({ key }) => onSectionChange(key)}
          style={{ borderRight: 0 }}
          items={menuItems}
        />
        {isScrollable && (
          <div className="nav-scrollbar-overlay" aria-hidden>
            <div
              className="nav-scrollbar-thumb"
              style={{
                height: thumbStyle.height ? `${thumbStyle.height}px` : undefined,
                transform: `translateY(${thumbStyle.y}px)`,
              }}
            />
          </div>
        )}
      </div>
      
      {/* Footer Area */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
         <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 16, fontSize: '12px', color: '#8c8c8c' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#52c41a' }}>✓</span> 已完成
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#1890ff' }}>•</span> 进行中
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#bfbfbf' }}>○</span> 未开始
            </div>
         </div>
         
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Tooltip title="返回首页">
              <Button icon={<HomeOutlined />} onClick={onGoHome} block>首页</Button>
            </Tooltip>
            <Tooltip title="返回列表">
              <Button icon={<ArrowLeftOutlined />} onClick={onGoInterviewStart} block>列表</Button>
            </Tooltip>
         </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
