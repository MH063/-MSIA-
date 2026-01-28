import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAssistantStore } from '../../../../store/assistant.store';
import './assistant-overlay.css';

type TabKey = 'teaching' | 'validation' | 'techniques' | 'training';

const AssistantOverlay: React.FC = () => {
  const hasNewMessage = useAssistantStore(s => s.hasNewMessage);
  const panel = useAssistantStore(s => s.panel);
  const actions = useAssistantStore(s => s.actions);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'mini' | 'drawer'>('mini');
  const [tab, setTab] = useState<TabKey>('teaching');
  const [width, setWidth] = useState(360);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(360);

  const handleToggle = () => {
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

  const teachingContent = useMemo(() => {
    const tips = panel.tips || [];
    const guidance = panel.guidance || [];
    const timeline = panel.timeline || [];
    return (
      <div className="drawer-section">
        {tips.length > 0 && <div className="section-block"><div className="block-title">提示</div><ul>{tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
        {guidance.length > 0 && <div className="section-block"><div className="block-title">引导</div><ul>{guidance.map((g, i) => <li key={i}>{g}</li>)}</ul></div>}
        {timeline.length > 0 && <div className="section-block"><div className="block-title">时间线</div><ul>{timeline.map((t, i) => <li key={i}>{t.label} {t.done ? '✓' : '—'}</li>)}</ul></div>}
      </div>
    );
  }, [panel.tips, panel.guidance, panel.timeline]);

  const validationContent = useMemo(() => {
    const text = panel.validationText || panel.hpiCareValidationTip || panel.maritalValidation || panel.redFlagsTip || panel.conflictTip;
    return (
      <div className="drawer-section">
        {text && <div className="section-block"><div className="block-title">校验</div><div className="block-text">{text}</div></div>}
      </div>
    );
  }, [panel.validationText, panel.hpiCareValidationTip, panel.maritalValidation, panel.redFlagsTip, panel.conflictTip]);

  const techniquesContent = useMemo(() => {
    const diseases = panel.diseases || [];
    const recognition = panel.recognition;
    return (
      <div className="drawer-section">
        {recognition && <div className="section-block"><div className="block-title">识别</div><div className="block-text">{[recognition.symptom, recognition.duration].filter(Boolean).join(' / ')}</div></div>}
        {diseases.length > 0 && <div className="section-block"><div className="block-title">疑似诊断</div><ul>{diseases.map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
      </div>
    );
  }, [panel.recognition, panel.diseases]);

  const trainingContent = useMemo(() => {
    const summary = panel.familySummary || panel.occupationalExposureTip || panel.pregnancyRedFlagsTip || panel.weeklyAlcoholHint;
    return (
      <div className="drawer-section">
        {summary && <div className="section-block"><div className="block-title">训练提示</div><div className="block-text">{summary}</div></div>}
      </div>
    );
  }, [panel.familySummary, panel.occupationalExposureTip, panel.pregnancyRedFlagsTip, panel.weeklyAlcoholHint]);

  const content = tab === 'teaching' ? teachingContent
    : tab === 'validation' ? validationContent
    : tab === 'techniques' ? techniquesContent
    : trainingContent;

  return (
    <>
      <button
        className={`floating-assistant-btn ${hasNewMessage ? 'has-message' : ''}`}
        onClick={handleToggle}
        aria-label="打开助手"
      >
        🎓
      </button>

      {open && mode === 'mini' && (
        <div className="assistant-mini-panel">
          <div className="mini-header">
            <div className="mini-title">智能问诊助手</div>
            <div className="mini-actions">
              <button className="link-btn" onClick={handleOpenDetail}>详细</button>
              <button className="link-btn" onClick={handleClose}>关闭</button>
            </div>
          </div>
          <div className="mini-body">
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
          </div>
          <div className="mini-footer">
            <button className="mini-btn" onClick={() => actions.startVoiceInput?.()}>🎤 语音</button>
            <button className="mini-btn" onClick={() => actions.openDetailHelp?.()}>❓ 帮助</button>
            <button className="mini-btn" onClick={() => actions.checkHpiCompleteness?.()}>✅ 检查</button>
          </div>
        </div>
      )}

      {open && mode === 'drawer' && (
        <div className="assistant-drawer" style={{ width }}>
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
            <button className={tab === 'training' ? 'active' : ''} onClick={() => setTab('training')}>模拟训练</button>
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
