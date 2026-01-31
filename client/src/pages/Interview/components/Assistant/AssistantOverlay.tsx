import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RobotOutlined } from '@ant-design/icons';
import { useAssistantStore } from '../../../../store/assistant.store';
import KnowledgeTab from './KnowledgeTab';
import './assistant-overlay.css';

type TabKey = 'teaching' | 'validation' | 'techniques' | 'training' | 'knowledge';

const AssistantOverlay: React.FC = () => {
  const hasNewMessage = useAssistantStore(s => s.hasNewMessage);
  const moduleLabel = useAssistantStore(s => s.moduleLabel);
  const moduleKey = useAssistantStore(s => s.moduleKey);
  const progressPercent = useAssistantStore(s => s.progressPercent);
  const panel = useAssistantStore(s => s.panel);
  const actions = useAssistantStore(s => s.actions);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'mini' | 'drawer'>('mini');
  const [tab, setTab] = useState<TabKey>('teaching');
  const [width, setWidth] = useState(360);
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
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(360);

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

  const onMouseDownResize = (e: React.MouseEvent<HTMLDivElement>) => {
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const dx = startXRef.current - e.clientX;
      const next = Math.min(560, Math.max(280, startWidthRef.current + dx));
      setWidth(next);
    };
    const onMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = false;
        document.body.style.cursor = 'default';
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [width]);

  /**
   * 教学指导Tab内容
   * 使用整个panel作为依赖，确保数据及时更新
   */
  const teachingContent = useMemo(() => {
    const tips = panel.tips || [];
    const guidance = panel.guidance || [];
    const timeline = panel.timeline || [];
    const sampleInput = panel.sampleInput;
    const normative = panel.normative;
    return (
      <div className="drawer-section">
        {sampleInput && (
          <div className="section-block">
            <div className="block-title">输入示例</div>
            <div className="block-text">{sampleInput}</div>
          </div>
        )}
        {normative?.good && (
          <div className="section-block">
            <div className="block-title">规范建议</div>
            <div className="block-text" style={{ color: '#52c41a' }}>{normative.good}</div>
            {normative.bad && normative.bad !== sampleInput && (
              <div className="block-text" style={{ color: '#999', textDecoration: 'line-through', fontSize: '12px', marginTop: 4 }}>
                原输入：{normative.bad}
              </div>
            )}
          </div>
        )}
        {tips.length > 0 && <div className="section-block"><div className="block-title">提示</div><ul>{tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
        {guidance.length > 0 && <div className="section-block"><div className="block-title">引导</div><ul>{guidance.map((g, i) => <li key={i}>{g}</li>)}</ul></div>}
        {timeline.length > 0 && <div className="section-block"><div className="block-title">时间线</div><ul>{timeline.map((t, i) => <li key={i}>{t.label} {t.done ? '✓' : '—'}</li>)}</ul></div>}
      </div>
    );
  }, [panel]);

  /**
   * 智能验证Tab内容
   */
  const validationContent = useMemo(() => {
    const text = panel.validationText || panel.hpiCareValidationTip || panel.maritalValidation || panel.redFlagsTip || panel.conflictTip;
    const omissions = panel.omissions || [];
    return (
      <div className="drawer-section">
        {text && <div className="section-block"><div className="block-title">校验</div><div className="block-text">{text}</div></div>}
        {omissions.length > 0 && (
          <div className="section-block">
            <div className="block-title">遗漏项</div>
            <ul>{omissions.map((o, i) => <li key={i} style={{ color: '#faad14' }}>{o}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }, [panel]);

  /**
   * 问诊技巧Tab内容
   */
  const techniquesContent = useMemo(() => {
    const diseases = panel.diseases || [];
    const recognition = panel.recognition;
    const actions = panel.actions || [];
    return (
      <div className="drawer-section">
        {recognition && (
          <div className="section-block">
            <div className="block-title">症状识别</div>
            <div className="block-text">
              {recognition.symptom && <div>症状：{recognition.symptom}</div>}
              {recognition.duration && <div>持续时间：{recognition.duration}</div>}
            </div>
          </div>
        )}
        {diseases.length > 0 && <div className="section-block"><div className="block-title">疑似诊断</div><ul>{diseases.map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
        {actions.length > 0 && <div className="section-block"><div className="block-title">建议操作</div><ul>{actions.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
      </div>
    );
  }, [panel]);

  /**
   * 练习模式Tab内容
   */
  const trainingContent = useMemo(() => {
    const summary = panel.familySummary || panel.occupationalExposureTip || panel.pregnancyRedFlagsTip || panel.weeklyAlcoholHint;
    const geneticRiskTip = panel.geneticRiskTip;
    const smokingIndexHint = panel.smokingIndexHint;
    const drinkingHint = panel.drinkingHint;
    return (
      <div className="drawer-section">
        {summary && <div className="section-block"><div className="block-title">训练提示</div><div className="block-text">{summary}</div></div>}
        {geneticRiskTip && <div className="section-block"><div className="block-title">遗传风险</div><div className="block-text">{geneticRiskTip}</div></div>}
        {smokingIndexHint && <div className="section-block"><div className="block-title">吸烟指数</div><div className="block-text">{smokingIndexHint}</div></div>}
        {drinkingHint && <div className="section-block"><div className="block-title">饮酒提示</div><div className="block-text">{drinkingHint}</div></div>}
      </div>
    );
  }, [panel]);

  const knowledgeContent = <KnowledgeTab />;

  const content = tab === 'teaching' ? teachingContent
    : tab === 'validation' ? validationContent
    : tab === 'techniques' ? techniquesContent
    : tab === 'training' ? trainingContent
    : knowledgeContent;

  const floatingSafePadding = 8;
  const anchorGap = 12;
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
  const buttonSize = isMobile ? 50 : 60;

  const buttonStyle: React.CSSProperties | undefined = position
    ? { position: 'fixed', left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : undefined;

  const miniPanelStyle: React.CSSProperties | undefined = useMemo(() => {
    if (!position || typeof window === 'undefined') return undefined;
    const panelWidth = isMobile ? Math.min(window.innerWidth * 0.9, 420) : 360;
    const estimatedHeight = isMobile ? 260 : 280;

    const preferAbove = position.y > estimatedHeight + anchorGap + floatingSafePadding;
    const desiredTop = preferAbove
      ? position.y - estimatedHeight - anchorGap
      : position.y + buttonSize + anchorGap;

    const maxLeft = Math.max(floatingSafePadding, window.innerWidth - panelWidth - floatingSafePadding);
    const desiredLeft = position.x + buttonSize - panelWidth;

    return {
      position: 'fixed',
      left: Math.max(floatingSafePadding, Math.min(maxLeft, desiredLeft)),
      top: Math.max(floatingSafePadding, Math.min(window.innerHeight - floatingSafePadding - 120, desiredTop)),
      right: 'auto',
      bottom: 'auto',
      width: panelWidth,
    };
  }, [buttonSize, isMobile, position]);

  const drawerStyle: React.CSSProperties = useMemo(() => {
    if (!position || typeof window === 'undefined' || isMobile) return { width };
    const maxHeight = Math.max(320, window.innerHeight - floatingSafePadding * 2);
    const height = Math.min(640, maxHeight);
    const preferRight = position.x < window.innerWidth / 2;
    const desiredLeft = preferRight
      ? position.x + buttonSize + anchorGap
      : position.x - width - anchorGap;
    const maxLeft = Math.max(floatingSafePadding, window.innerWidth - width - floatingSafePadding);
    const left = Math.max(floatingSafePadding, Math.min(maxLeft, desiredLeft));

    const desiredTop = position.y - 120;
    const maxTop = Math.max(floatingSafePadding, window.innerHeight - height - floatingSafePadding);
    const top = Math.max(floatingSafePadding, Math.min(maxTop, desiredTop));
    return {
      position: 'fixed',
      left,
      width,
      top,
      height,
      right: 'auto',
      bottom: 'auto',
    };
  }, [anchorGap, buttonSize, floatingSafePadding, isMobile, position, width]);

  const renderMiniActions = () => {
    const items: Array<{ label: string; onClick: () => void }> = [];

    if (moduleKey === 'chief_complaint' && actions.improveChiefComplaint) {
      items.push({ label: '智能完善', onClick: actions.improveChiefComplaint });
    }
    if (moduleKey === 'hpi' && actions.checkHpiCompleteness) {
      items.push({ label: '完整性检查', onClick: actions.checkHpiCompleteness });
    }
    if (moduleKey === 'past_history' && actions.completePastHistory) {
      items.push({ label: '智能补全', onClick: actions.completePastHistory });
    }
    if (moduleKey === 'review_of_systems' && actions.remindRedFlags) {
      items.push({ label: '红旗征提醒', onClick: actions.remindRedFlags });
    }
    if (moduleKey === 'review_of_systems' && actions.guideReviewOfSystems) {
      items.push({ label: '引导', onClick: actions.guideReviewOfSystems });
    }
    if (moduleKey === 'personal_history' && actions.showPersonalHints) {
      items.push({ label: '智能提示', onClick: actions.showPersonalHints });
    }
    if (moduleKey === 'personal_history' && actions.suggestOccupationalExposure) {
      items.push({ label: '职业暴露提示', onClick: actions.suggestOccupationalExposure });
    }
    if (moduleKey === 'marital_history' && actions.validateMaritalHistory) {
      items.push({ label: '信息校验', onClick: actions.validateMaritalHistory });
    }
    if (moduleKey === 'marital_history' && actions.showPregnancyRedFlags) {
      items.push({ label: '妊娠红旗提示', onClick: actions.showPregnancyRedFlags });
    }
    if (moduleKey === 'family_history' && actions.summarizeFamilyHistory) {
      items.push({ label: '生成摘要', onClick: actions.summarizeFamilyHistory });
    }
    if (moduleKey === 'family_history' && actions.detectFamilyConflict) {
      items.push({ label: '冲突检测', onClick: actions.detectFamilyConflict });
    }
    if (moduleKey === 'family_history' && actions.assessGeneticRisk) {
      items.push({ label: '遗传风险评估', onClick: actions.assessGeneticRisk });
    }
    if (actions.openDetailHelp) {
      items.push({ label: '帮助', onClick: actions.openDetailHelp });
    }

    return items.slice(0, 3);
  };

  const miniActions = renderMiniActions();

  return (
    <>
      <button
        ref={btnRef}
        className={`floating-assistant-btn ${hasNewMessage ? 'has-message' : ''}`}
        style={buttonStyle}
        onPointerDown={handlePointerDown}
        onClick={handleToggle}
        aria-label="打开助手"
      >
        <RobotOutlined />
      </button>

      {open && mode === 'mini' && (
        <div className="assistant-mini-panel" style={miniPanelStyle}>
          <div className="mini-header">
            <div className="mini-title">智能问诊助手</div>
            <div className="mini-actions">
              <button className="link-btn" onClick={handleOpenDetail}>详细</button>
              <button className="link-btn" onClick={handleClose}>关闭</button>
            </div>
          </div>
          <div className="mini-body">
            <div className="mini-block">
              <div className="mini-label">当前模块</div>
              <div className="mini-text">{moduleLabel || '未选择'}</div>
            </div>
            <div className="mini-block">
              <div className="mini-label">进度</div>
              <div className="mini-text">{Math.round(progressPercent)}%</div>
            </div>
            {panel.sampleInput && (
              <div className="mini-block">
                <div className="mini-label">输入</div>
                <div className="mini-text">{panel.sampleInput}</div>
              </div>
            )}
            {panel.normative?.good && (
              <div className="mini-block">
                <div className="mini-label">建议</div>
                <div className="mini-text">{panel.normative.good}</div>
              </div>
            )}
            {Array.isArray(panel.pendingItems) && panel.pendingItems.length > 0 && (
              <div className="mini-block">
                <div className="mini-label">待补充</div>
                <div className="mini-text">{panel.pendingItems.slice(0, 6).join('、')}</div>
              </div>
            )}
            {panel.validationText && (
              <div className="mini-block">
                <div className="mini-label">校验</div>
                <div className="mini-text">{panel.validationText}</div>
              </div>
            )}
          </div>
          <div className="mini-footer">
            {miniActions.length > 0 ? (
              miniActions.map((it) => (
                <button key={it.label} className="mini-btn" onClick={it.onClick}>{it.label}</button>
              ))
            ) : (
              <button className="mini-btn" onClick={handleOpenDetail}>详细</button>
            )}
          </div>
        </div>
      )}

      {open && mode === 'drawer' && (
        <div className="assistant-drawer" style={drawerStyle}>
          <div className="drawer-header">
            <h3>智能问诊助手</h3>
            <div className="drawer-actions">
              <button className="btn-minimize" onClick={handleMinimize}>－</button>
              <button className="btn-close" onClick={handleClose}>×</button>
            </div>
          </div>
          <div className="drawer-tabs">
            <button className={tab === 'teaching' ? 'active' : ''} onClick={() => setTab('teaching')}>教学指导</button>
            <button className={tab === 'validation' ? 'active' : ''} onClick={() => setTab('validation')}>智能验证</button>
            <button className={tab === 'techniques' ? 'active' : ''} onClick={() => setTab('techniques')}>问诊技巧</button>
            <button className={tab === 'training' ? 'active' : ''} onClick={() => setTab('training')}>练习模式</button>
            <button className={tab === 'knowledge' ? 'active' : ''} onClick={() => setTab('knowledge')}>知识库</button>
          </div>
          <div className="drawer-content">
            {content}
          </div>
          <div className="drawer-footer">
            <button className="voice-btn" onClick={() => actions.startVoiceInput?.()}>🎤 语音</button>
            <button className="help-btn" onClick={() => actions.openDetailHelp?.()}>❓ 帮助</button>
            <button className="check-btn" onClick={() => actions.checkHpiCompleteness?.()}>✅ 检查</button>
          </div>
          <div className="drawer-resizer" onMouseDown={onMouseDownResize} />
        </div>
      )}
    </>
  );
};

export default AssistantOverlay;
