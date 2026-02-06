import React, { useEffect, useRef, useState } from 'react';
import { RobotOutlined, CloseOutlined, ExpandOutlined, ShrinkOutlined, QuestionCircleOutlined, SoundOutlined } from '@ant-design/icons';
import { theme, Tooltip, Button, Tabs, Badge } from 'antd';
import { useAssistantStore } from '../../../../store/assistant.store';
import KnowledgeTab from './KnowledgeTab';
import TeachingTab from './TeachingTab';
import ValidationTab from './ValidationTab';

type TabKey = 'teaching' | 'validation' | 'techniques' | 'training' | 'knowledge';

const AssistantOverlay: React.FC = () => {
  const { token } = theme.useToken();
  const hasNewMessage = useAssistantStore(s => s.hasNewMessage);
  // const moduleLabel = useAssistantStore(s => s.moduleLabel);
  // const moduleKey = useAssistantStore(s => s.moduleKey);
  // const progressPercent = useAssistantStore(s => s.progressPercent);
  // const panel = useAssistantStore(s => s.panel);
  // const actions = useAssistantStore(s => s.actions);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'mini' | 'drawer'>('mini');
  const [tab, setTab] = useState<TabKey>('teaching');
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * 从localStorage加载保存的位置
   * 包含错误处理和位置验证
   */
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = window.localStorage.getItem('assistantOverlayPos');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { x: number; y: number };
      
      // 验证坐标值是否有效
      if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) {
        console.warn('[问诊助手] 保存的位置坐标无效，重置位置');
        window.localStorage.removeItem('assistantOverlayPos');
        return null;
      }

      const edgePadding = 16;
      const w = 60;
      const h = 60;
      const maxX = Math.max(edgePadding, window.innerWidth - w - edgePadding);
      const maxY = Math.max(edgePadding, window.innerHeight - h - edgePadding);
      const clamped = {
        x: Math.max(edgePadding, Math.min(maxX, parsed.x)),
        y: Math.max(edgePadding, Math.min(maxY, parsed.y)),
      };

      if (clamped.x !== parsed.x || clamped.y !== parsed.y) {
        const flagKey = 'assistantOverlayPosAdjustedOnce';
        if (!window.sessionStorage.getItem(flagKey)) {
          console.log('[问诊助手] 保存的位置超出可视区域，已自动修正', { from: parsed, to: clamped });
          window.sessionStorage.setItem(flagKey, '1');
        }
        return clamped;
      }

      return parsed;
    } catch (e) {
      console.warn('[问诊助手] 位置加载失败，使用默认位置', e);
      try { window.localStorage.removeItem('assistantOverlayPos'); } catch (removeError) {
        console.warn('[问诊助手] 清理保存位置失败', removeError);
      }
      return null;
    }
  });
  const positionRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const clampToViewport = React.useCallback((pos: { x: number; y: number }) => {
    const edgePadding = 16;
    const el = btnRef.current;
    const w = el?.offsetWidth ?? 60;
    const h = el?.offsetHeight ?? 60;
    const maxX = Math.max(edgePadding, window.innerWidth - w - edgePadding);
    const maxY = Math.max(edgePadding, window.innerHeight - h - edgePadding);
    return {
      x: Math.max(edgePadding, Math.min(maxX, pos.x)),
      y: Math.max(edgePadding, Math.min(maxY, pos.y)),
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const currentPos = positionRef.current;
      if (!currentPos || typeof window === 'undefined') return;

      const next = clampToViewport(currentPos);
      if (next.x !== currentPos.x || next.y !== currentPos.y) {
        setPosition(next);
        // positionRef will be updated by the effect on position change
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampToViewport]);

  /**
   * 保存位置到localStorage
   * 包含详细的错误处理和用户提示
   */
  const savePosition = React.useCallback((pos: { x: number; y: number }) => {
    try {
      // 验证坐标值
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
        console.warn('[问诊助手] 无效的位置坐标，跳过保存', pos);
        return;
      }
      
      // 尝试保存到localStorage
      localStorage.setItem('assistantOverlayPos', JSON.stringify(pos));
      console.log('[问诊助手] 位置保存成功', pos);
    } catch (e) {
      // 处理各种localStorage错误
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('[问诊助手] 存储空间不足，位置保存失败');
        // 尝试清理旧数据后重试
        try {
          localStorage.removeItem('assistantOverlayPos');
          localStorage.setItem('assistantOverlayPos', JSON.stringify(pos));
          console.log('[问诊助手] 清理后位置保存成功');
        } catch (retryError) {
          console.error('[问诊助手] 位置保存重试失败', retryError);
        }
      } else if (e instanceof DOMException && e.name === 'SecurityError') {
        console.warn('[问诊助手] 隐私模式下无法保存位置');
      } else {
        console.error('[问诊助手] 位置保存失败', e);
      }
    }
  }, []);

  const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const el = btnRef.current;
    if (!el) return;
    setIsDragging(true);
    el.setPointerCapture?.(e.pointerId);
    const rect = el.getBoundingClientRect();
    const origin = position ?? { x: rect.left, y: rect.top };
    dragStartRef.current = { startX: e.clientX, startY: e.clientY, originX: origin.x, originY: origin.y };
    console.log('[问诊助手] 开始拖动');

    const onMove = (ev: PointerEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      const next = clampToViewport({
        x: start.originX + (ev.clientX - start.startX),
        y: start.originY + (ev.clientY - start.startY),
      });
      setPosition(next);
      positionRef.current = next;
    };

    const onUp = () => {
      setIsDragging(false);
      if (positionRef.current) savePosition(positionRef.current);
      dragStartRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      console.log('[问诊助手] 结束拖动');
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [clampToViewport, position, savePosition]);

  const handleToggle = () => {
    if (isDragging) return;
    if (!open) {
      setMode('mini');
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleOpenDetail = () => {
    setMode('drawer');
    setOpen(true);
  };

  const handleMinimize = () => {
    setMode('mini');
  };

  const handleClose = () => {
    setOpen(false);
  };

  // Dynamic Styles
  const pulseKeyframes = `
    @keyframes assistantPulse {
      0% { box-shadow: 0 0 0 0 ${token.colorPrimary}b3; }
      70% { box-shadow: 0 0 0 12px ${token.colorPrimary}00; }
      100% { box-shadow: 0 0 0 0 ${token.colorPrimary}00; }
    }
  `;

  const styles = {
    floatingBtn: {
      position: 'fixed' as const,
      bottom: 24,
      right: 24,
      width: 60,
      height: 60,
      borderRadius: '50%',
      border: 'none',
      background: token.colorPrimary,
      color: '#fff',
      fontSize: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 1,
      cursor: 'pointer',
      zIndex: 1000,
      boxShadow: token.boxShadow,
      ...(position ? { left: position.x, top: position.y, bottom: 'auto', right: 'auto' } : {}),
      animation: hasNewMessage ? 'assistantPulse 2s infinite' : 'none',
      touchAction: 'none' as const, // Prevents scrolling while dragging on touch devices
    },
    miniPanel: {
      position: 'fixed' as const,
      bottom: position ? 'auto' : 96,
      top: position ? position.y - 12 - 200 : 'auto', // Adjust based on height roughly
      left: position ? position.x - 300 : 'auto', // Adjust based on width
      right: position ? 'auto' : 24,
      width: 360,
      background: token.colorBgContainer,
      border: `1px solid ${token.colorBorder}`,
      borderRadius: token.borderRadiusLG,
      boxShadow: token.boxShadowSecondary,
      zIndex: 1000,
    },
    miniHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
    },
    miniBody: {
      padding: 12,
      maxHeight: 300,
      overflowY: 'auto' as const,
    },
    miniFooter: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8,
      padding: '8px 12px',
      borderTop: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorFillQuaternary,
      borderBottomLeftRadius: token.borderRadiusLG,
      borderBottomRightRadius: token.borderRadiusLG,
    },
    drawer: {
      position: 'fixed' as const,
      top: 0,
      right: 0,
      height: '100vh',
      width: 360,
      background: token.colorBgContainer,
      borderLeft: `1px solid ${token.colorBorder}`,
      boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column' as const,
    },
    drawerHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
    },
    drawerContent: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: 12,
      background: token.colorBgLayout,
    },
    drawerFooter: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8,
      padding: '10px 12px',
      borderTop: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorBgContainer,
    },
  };

  // Adjust mini panel position logic slightly to anchor to the button better
  // If button is at (x, y), panel should be near it.
  // For simplicity, let's keep it fixed bottom-right relative to button if dragged, or default if not.
  // Actually, standard behavior is usually above or to the side.
  // Let's stick to default right-bottom for now, and if position is set, anchor top-right of panel to button's top-left?
  // Simpler: Just render Mini Panel near the button.
  // We'll calculate miniPanel style dynamically.

  const getMiniPanelStyle = () => {
    if (!position) return styles.miniPanel;
    
    // Anchor panel above the button
    // Button is 60x60
    const panelHeight = 250; // approx
    const panelWidth = 360;
    
    let top = position.y - panelHeight - 12;
    let left = position.x - panelWidth + 60; // Align right edges roughly

    // Boundary checks
    if (top < 16) top = position.y + 72; // Flip to below if too high
    if (left < 16) left = 16;
    if (left + panelWidth > window.innerWidth - 16) left = window.innerWidth - panelWidth - 16;

    return {
      ...styles.miniPanel,
      top,
      left,
      bottom: 'auto',
      right: 'auto',
    };
  };

  const renderMini = () => (
    <div style={getMiniPanelStyle()}>
      <div style={styles.miniHeader}>
        <span style={{ fontWeight: 600, color: token.colorText }}>问诊助手</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="展开详情">
            <Button type="text" size="small" icon={<ExpandOutlined />} onClick={handleOpenDetail} />
          </Tooltip>
          <Tooltip title="关闭">
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleClose} />
          </Tooltip>
        </div>
      </div>
      <div style={styles.miniBody}>
        {/* Simplified Mini Content */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>当前建议</div>
          <div style={{ fontSize: 14, color: token.colorText }}>
            建议询问患者是否有<span style={{ color: token.colorPrimary, fontWeight: 500 }}>发热</span>伴随症状。
          </div>
        </div>
        {hasNewMessage && (
           <Badge status="processing" text="有新的指导建议" />
        )}
      </div>
      <div style={styles.miniFooter}>
        <Button size="small" onClick={handleOpenDetail}>查看详情</Button>
      </div>
    </div>
  );

  const renderDrawer = () => (
    <div style={styles.drawer}>
      <div style={styles.drawerHeader}>
        <div style={{ fontWeight: 600, fontSize: 16, color: token.colorText }}>问诊助手</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tooltip title="最小化">
            <Button type="text" icon={<ShrinkOutlined />} onClick={handleMinimize} />
          </Tooltip>
          <Tooltip title="关闭">
            <Button type="text" icon={<CloseOutlined />} onClick={handleClose} />
          </Tooltip>
        </div>
      </div>
      
      <div style={{ padding: '0 12px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as TabKey)}
          items={[
            { key: 'teaching', label: '教学指导' },
            { key: 'validation', label: '完整性校验' },
            { key: 'knowledge', label: '知识库' },
          ]}
        />
      </div>

      <div style={styles.drawerContent}>
        {tab === 'knowledge' && <KnowledgeTab />}
        {tab === 'teaching' && <TeachingTab />}
        {tab === 'validation' && <ValidationTab />}
      </div>

      <div style={styles.drawerFooter}>
        <Tooltip title="语音输入(开发中)">
          <Button icon={<SoundOutlined />} disabled />
        </Tooltip>
        <Tooltip title="帮助">
          <Button icon={<QuestionCircleOutlined />} />
        </Tooltip>
      </div>
    </div>
  );

  return (
    <>
      <style>{pulseKeyframes}</style>
      
      {/* Floating Entry Button */}
      <button
        ref={btnRef}
        className="floating-assistant-btn" // Keep class for potential external overrides, but styles are inline
        style={styles.floatingBtn}
        onPointerDown={handlePointerDown}
        onClick={handleToggle}
      >
        <RobotOutlined />
      </button>

      {/* Panel Content */}
      {open && mode === 'mini' && renderMini()}
      {open && mode === 'drawer' && renderDrawer()}
    </>
  );
};

export default AssistantOverlay;
