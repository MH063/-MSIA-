import React from 'react';
import { useAssistantStore } from '../store/assistant.store';

type Status = 'default' | 'new-message' | 'recording' | 'thinking' | 'error';
type IconVariant = 'robot' | 'cap';

interface FloatingAssistantButtonProps {
  status?: Status;
  iconVariant?: IconVariant;
  onClick?: () => void;
  currentLabel?: string;
  progressPercent?: number;
}

/**
 * FloatingAssistantButton
 * 全局可拖动的浮动助手按钮组件，支持多种状态展示与位置持久化
 */
const FloatingAssistantButton: React.FC<FloatingAssistantButtonProps> = ({
  status = 'default',
  iconVariant = 'robot',
  onClick,
  currentLabel = '一般项目',
  progressPercent = 25,
}) => {
  const btnRef = React.useRef<HTMLDivElement | null>(null);
  const [active, setActive] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);
  const dragStartRef = React.useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [panelPos, setPanelPos] = React.useState<{ left: number; top: number } | null>(null);
  const { moduleKey, moduleLabel, progressPercent: storeProgress, panel, hasNewMessage, actions } = useAssistantStore();

  /**
   * loadInitialPosition
   * 加载本地存储的按钮位置（若存在）
   */
  const loadInitialPosition = React.useCallback(() => {
    try {
      const raw = localStorage.getItem('floatingAssistantPos');
      if (raw) {
        const parsed = JSON.parse(raw) as { x: number; y: number };
        if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
          setPosition({ x: parsed.x, y: parsed.y });
        }
      }
    } catch (e) {
      console.log('[浮动按钮] 位置加载失败', e);
    }
  }, []);

  /**
   * savePosition
   * 持久化按钮位置到本地存储
   */
  const savePosition = React.useCallback((pos: { x: number; y: number }) => {
    try {
      localStorage.setItem('floatingAssistantPos', JSON.stringify(pos));
      console.log('[浮动按钮] 位置已保存', pos);
    } catch (e) {
      console.log('[浮动按钮] 位置保存失败', e);
    }
  }, []);

  React.useEffect(() => {
    loadInitialPosition();
  }, [loadInitialPosition]);

  /**
   * clampToViewport
   * 将拖动位置限定在视窗范围内，避免溢出
   */
  const clampToViewport = React.useCallback((x: number, y: number) => {
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const size = 60; // 按钮直径，与样式保持一致
    const nx = Math.min(Math.max(x, margin), vw - size - margin);
    const ny = Math.min(Math.max(y, margin), vh - size - margin);
    return { x: nx, y: ny };
  }, []);

  /**
   * handlePointerDown
   * 开始拖动，记录起始坐标与原始位置
   */
  const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = btnRef.current?.getBoundingClientRect();
    const originX = position?.x ?? (rect ? rect.left : window.innerWidth - 90);
    const originY = position?.y ?? (rect ? rect.top : window.innerHeight - 90);
    dragStartRef.current = { startX: e.clientX, startY: e.clientY, originX, originY };
    setIsDragging(true);
    console.log('[浮动按钮] 开始拖动');

    const onMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.startX;
      const dy = ev.clientY - dragStartRef.current.startY;
      const next = clampToViewport(dragStartRef.current.originX + dx, dragStartRef.current.originY + dy);
      setPosition(next);
    };
    const onUp = () => {
      setIsDragging(false);
      if (position) savePosition(position);
      dragStartRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      console.log('[浮动按钮] 结束拖动');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [position, clampToViewport, savePosition]);

  /**
   * handleClick
   * 切换活动态并触发外部点击回调
   */
  const handleClick = React.useCallback(() => {
    if (isDragging) return;
    setActive((prev) => !prev);
    console.log('[浮动按钮] 点击事件，active =', !active);
    onClick?.();
  }, [isDragging, onClick, active]);

  /**
   * renderIcon
   * 根据当前状态与图标风格渲染图标
   */
  const renderIcon = React.useMemo(() => {
    switch (status) {
      case 'recording':
        return '🎤';
      case 'thinking':
        return '⏳';
      case 'error':
        return '⚠️';
      case 'new-message':
      case 'default':
      default:
        return iconVariant === 'cap' ? '🎓' : '🤖';
    }
  }, [status, iconVariant]);

  const style: React.CSSProperties = position
    ? { position: 'fixed', left: position.x, top: position.y }
    : {};

  const className = [
    'floating-assistant-btn',
    (status === 'new-message' || hasNewMessage) ? 'new-message' : '',
    status === 'recording' ? 'recording' : '',
    status === 'thinking' ? 'thinking' : '',
    status === 'error' ? 'error' : '',
    active ? 'active' : '',
    isDragging ? 'dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  /**
   * updatePanelPosition
   * 计算迷你面板位置，尽量贴近按钮且不出屏
   */
  const updatePanelPosition = React.useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) {
      setPanelPos(null);
      return;
    }
    const panelWidth = 220;
    const panelHeight = 200;
    const margin = 10;
    let left = rect.left - panelWidth - margin;
    let top = rect.top - (panelHeight - rect.height) / 2;

    // 屏幕边界约束
    if (left < 8) {
      left = rect.right + margin;
    }
    if (top < 8) {
      top = 8;
    }
    const maxLeft = window.innerWidth - panelWidth - 8;
    const maxTop = window.innerHeight - panelHeight - 8;
    if (left > maxLeft) left = maxLeft;
    if (top > maxTop) top = maxTop;
    setPanelPos({ left, top });
  }, []);

  React.useEffect(() => {
    if (active) {
      updatePanelPosition();
      const onResize = () => updatePanelPosition();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [active, position, updatePanelPosition]);

  /**
   * handleOutsideClick
   * 点击面板外区域时关闭迷你面板
   */
  React.useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const panel = document.getElementById('assistant-mini-panel');
      if (panel && !panel.contains(target) && btnRef.current && !btnRef.current.contains(target)) {
        setActive(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active]);

  /**
   * renderModulePanel
   * 按模块渲染迷你面板内容
   */
  const renderModulePanel = React.useCallback(() => {
    const key = moduleKey || 'general';
    const label = moduleLabel || currentLabel;
    const percent = (storeProgress ?? progressPercent);
    switch (key) {
      case 'general':
        return (
          <div className="panel-body">
            <div className="panel-row">当前：{label} ({percent}%)</div>
            <div className="panel-sep" />
            <div className="panel-row">● 待完成项：</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {(panel.pendingItems || ['出生地', '职业', '联系电话']).map((it, idx) => (
                <li key={idx}>{it} □</li>
              ))}
            </ul>
            <div className="panel-sep" />
            <div className="panel-row">💡 快速提示：</div>
            <div style={{ marginTop: 4 }}>
              {(panel.tips || ['年龄联动', '病史陈述者']).map((t, idx) => (
                <span key={idx} style={{ display: 'inline-block', padding: '2px 8px', border: '1px solid #e6f4ff', borderRadius: 12, marginRight: 6, color: '#1677ff' }}>{t}</span>
              ))}
            </div>
            <div className="panel-sep" />
            <div className="panel-row">⚠️ 验证结果：</div>
            <div style={{ marginTop: 4, color: '#8c8c8c' }}>{panel.validationText || '必填项：3/5完成'}</div>
            <div className="panel-footer">
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.startVoiceInput) {
                    console.log('[助手] 语音输入触发');
                    actions.startVoiceInput();
                  } else {
                    console.log('[助手] 语音输入未注册处理函数');
                  }
                }}
              >
                语音输入
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.openDetailHelp) {
                    console.log('[助手] 详细帮助触发');
                    actions.openDetailHelp();
                  } else {
                    console.log('[助手] 详细帮助未注册处理函数');
                  }
                }}
              >
                详细帮助
              </button>
            </div>
          </div>
        );
      case 'chief_complaint':
        return (
          <div className="panel-body">
            <div className="panel-row">当前：主诉</div>
            <div className="panel-sep" />
            <div className="panel-row">📋 输入：" {panel.sampleInput || '发热5天'} "</div>
            <div className="panel-row">✅ 识别成功：</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>症状：{panel.recognition?.symptom || '发热'}</li>
              <li>时间：{panel.recognition?.duration || '5天'}</li>
            </ul>
            <div className="panel-sep" />
            <div className="panel-row">💡 规范建议：</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>"{panel.normative?.good || '发热5天'}" ✓</li>
              <li>"{panel.normative?.bad || '发烧好几天了'}" ✗</li>
            </ul>
            <div className="panel-sep" />
            <div className="panel-row">🔍 疾病关联：</div>
            <div style={{ marginTop: 4 }}>
              {(panel.diseases || ['上感', '肺炎', '流感']).map((d, idx) => (
                <span key={idx} style={{ display: 'inline-block', padding: '2px 8px', border: '1px solid #e6f4ff', borderRadius: 12, marginRight: 6, color: '#1677ff' }}>{d}</span>
              ))}
            </div>
            <div className="panel-footer">
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.improveChiefComplaint) {
                    console.log('[助手] 智能完善触发');
                    actions.improveChiefComplaint();
                  } else {
                    console.log('[助手] 智能完善未注册处理函数');
                  }
                }}
              >
                智能完善
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.openExampleLibrary) {
                    console.log('[助手] 示例库触发');
                    actions.openExampleLibrary();
                  } else {
                    console.log('[助手] 示例库未注册处理函数');
                  }
                }}
              >
                示例库
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.openDetailHelp) {
                    console.log('[助手] 详细帮助触发');
                    actions.openDetailHelp();
                  } else {
                    console.log('[助手] 详细帮助未注册处理函数');
                  }
                }}
              >
                详细
              </button>
            </div>
          </div>
        );
      case 'hpi':
        return (
          <div className="panel-body">
            <div className="panel-row">当前：现病史 ({percent}%)</div>
            <div className="panel-sep" />
            <div className="panel-row">⚠️ 诊治经过校验：{panel.hpiCareValidationTip || '未校验'}</div>
            <div className="panel-sep" />
            <div className="panel-row">⏱️ 时间线：</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {(panel.timeline || [
                { label: '5天前：起病', done: true },
                { label: '3天前：咳嗽', done: true },
                { label: '今日：待补充', done: false },
              ]).map((t, idx) => (
                <li key={idx}>{t.label} {t.done ? '✓' : '❌'}</li>
              ))}
            </ul>
            <div className="panel-sep" />
            <div className="panel-row">💡 问诊引导：</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {(panel.guidance || ['伴随症状？', '诊治经过？', '一般情况？']).map((g, idx) => <li key={idx}>{g}</li>)}
            </ul>
            <div className="panel-sep" />
            <div className="panel-row">⚠️ 常见遗漏：</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {(panel.omissions || ['阴性症状记录', '诊治经过详情']).map((o, idx) => <li key={idx}>{o}</li>)}
            </ul>
            <div className="panel-footer">
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.editTimeline) {
                    console.log('[助手] 时间线编辑触发');
                    actions.editTimeline();
                  } else {
                    console.log('[助手] 时间线编辑未注册处理函数');
                  }
                }}
              >
                时间线编辑
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.recommendSymptoms) {
                    console.log('[助手] 症状推荐触发');
                    actions.recommendSymptoms();
                  } else {
                    console.log('[助手] 症状推荐未注册处理函数');
                  }
                }}
              >
                症状推荐
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.checkHpiCompleteness) {
                    console.log('[助手] 诊治经过完整性校验触发');
                    actions.checkHpiCompleteness();
                  } else {
                    console.log('[助手] 诊治经过完整性校验未注册处理函数');
                  }
                }}
              >
                诊治经过校验
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.openDetailHelp) {
                    console.log('[助手] 详细帮助触发');
                    actions.openDetailHelp();
                  } else {
                    console.log('[助手] 详细帮助未注册处理函数');
                  }
                }}
              >
                详细
              </button>
            </div>
          </div>
        );
      case 'past_history':
        return (
          <div className="panel-body">
            <div className="panel-row">当前：既往史</div>
            <div className="panel-sep" />
            <div className="panel-row">💡 重点提示：</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>过敏史必须确认</li>
              <li>手术/外伤/输血需按时间+事件记录</li>
            </ul>
            <div className="panel-sep" />
            <div className="panel-footer">
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.completePastHistory) {
                    console.log('[助手] 既往史智能补全触发');
                    actions.completePastHistory();
                  } else {
                    console.log('[助手] 既往史智能补全未注册处理函数');
                  }
                }}
              >
                智能补全
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.openDetailHelp) {
                    console.log('[助手] 详细帮助触发');
                    actions.openDetailHelp();
                  } else {
                    console.log('[助手] 详细帮助未注册处理函数');
                  }
                }}
              >
                详细
              </button>
            </div>
          </div>
        );
      case 'review_of_systems':
        return (
          <div className="panel-body">
            <div className="panel-row">当前：系统回顾</div>
            <div className="panel-sep" />
            <div className="panel-row">⚠️ 红旗提醒：{panel.redFlagsTip || '未提醒'}</div>
            <div className="panel-sep" />
            <div className="panel-row">💡 引导要点：</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>至少记录一个系统</li>
              <li>注意重要阴性症状</li>
            </ul>
            <div className="panel-sep" />
            <div className="panel-footer">
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.remindRedFlags) {
                    console.log('[助手] 红旗征自动提醒触发');
                    actions.remindRedFlags();
                  } else {
                    console.log('[助手] 红旗征自动提醒未注册处理函数');
                  }
                }}
              >
                红旗征提醒
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.guideReviewOfSystems) {
                    console.log('[助手] 系统回顾引导触发');
                    actions.guideReviewOfSystems();
                  } else {
                    console.log('[助手] 系统回顾引导未注册处理函数');
                  }
                }}
              >
                引导
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.openDetailHelp) {
                    console.log('[助手] 详细帮助触发');
                    actions.openDetailHelp();
                  } else {
                    console.log('[助手] 详细帮助未注册处理函数');
                  }
                }}
              >
                详细
              </button>
            </div>
          </div>
        );
      case 'personal_history':
        return (
          <div className="panel-body">
            <div className="panel-row">当前：个人史</div>
            <div className="panel-sep" />
            <div className="panel-row">💡 吸烟指数提示：{panel.smokingIndexHint || '未计算'}</div>
            <div className="panel-row">💡 酒精量提示：{panel.drinkingHint || '未计算'}</div>
            <div className="panel-row">💡 每周总量：{panel.weeklyAlcoholHint || '未估算'}</div>
            <div className="panel-row">💡 职业暴露提示：{panel.occupationalExposureTip || '未识别'}</div>
            <div className="panel-sep" />
            <div className="panel-footer">
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.showPersonalHints) {
                    console.log('[助手] 个人史智能提示触发');
                    actions.showPersonalHints();
                  } else {
                    console.log('[助手] 个人史智能提示未注册处理函数');
                  }
                }}
              >
                智能提示
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.suggestOccupationalExposure) {
                    console.log('[助手] 职业暴露提示触发');
                    actions.suggestOccupationalExposure();
                  } else {
                    console.log('[助手] 职业暴露提示未注册处理函数');
                  }
                }}
              >
                职业暴露提示
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.openDetailHelp) {
                    console.log('[助手] 详细帮助触发');
                    actions.openDetailHelp();
                  } else {
                    console.log('[助手] 详细帮助未注册处理函数');
                  }
                }}
              >
                详细
              </button>
            </div>
          </div>
        );
      case 'marital_history':
        return (
          <div className="panel-body">
            <div className="panel-row">当前：婚育史</div>
            <div className="panel-sep" />
            <div className="panel-row">⚠️ 校验提示：{panel.maritalValidation || '未校验'}</div>
            <div className="panel-row">💡 妊娠红旗：{panel.pregnancyRedFlagsTip || '未提示'}</div>
            <div className="panel-sep" />
            <div className="panel-footer">
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.validateMaritalHistory) {
                    console.log('[助手] 婚育史信息校验触发');
                    actions.validateMaritalHistory();
                  } else {
                    console.log('[助手] 婚育史信息校验未注册处理函数');
                  }
                }}
              >
                信息校验
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.showPregnancyRedFlags) {
                    console.log('[助手] 妊娠红旗提示触发');
                    actions.showPregnancyRedFlags();
                  } else {
                    console.log('[助手] 妊娠红旗提示未注册处理函数');
                  }
                }}
              >
                妊娠红旗提示
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.openDetailHelp) {
                    console.log('[助手] 详细帮助触发');
                    actions.openDetailHelp();
                  } else {
                    console.log('[助手] 详细帮助未注册处理函数');
                  }
                }}
              >
                详细
              </button>
            </div>
          </div>
        );
      case 'family_history':
        return (
          <div className="panel-body">
            <div className="panel-row">当前：家族史</div>
            <div className="panel-sep" />
            <div className="panel-row">📄 摘要：{panel.familySummary || '暂无摘要'}</div>
            <div className="panel-row">💡 遗传风险提示：{panel.geneticRiskTip || '未评估'}</div>
            <div className="panel-row">⚠️ 冲突检测：{panel.conflictTip || '未检测'}</div>
            <div className="panel-sep" />
            <div className="panel-footer">
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.summarizeFamilyHistory) {
                    console.log('[助手] 家族史摘要生成触发');
                    actions.summarizeFamilyHistory();
                  } else {
                    console.log('[助手] 家族史摘要生成未注册处理函数');
                  }
                }}
              >
                生成摘要
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.detectFamilyConflict) {
                    console.log('[助手] 家族史冲突检测触发');
                    actions.detectFamilyConflict();
                  } else {
                    console.log('[助手] 家族史冲突检测未注册处理函数');
                  }
                }}
              >
                冲突检测
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.assessGeneticRisk) {
                    console.log('[助手] 遗传风险评估触发');
                    actions.assessGeneticRisk();
                  } else {
                    console.log('[助手] 遗传风险评估未注册处理函数');
                  }
                }}
              >
                遗传风险评估
              </button>
              <button
                className="panel-btn"
                onClick={() => {
                  if (actions?.openDetailHelp) {
                    console.log('[助手] 详细帮助触发');
                    actions.openDetailHelp();
                  } else {
                    console.log('[助手] 详细帮助未注册处理函数');
                  }
                }}
              >
                详细
              </button>
            </div>
          </div>
        );
      default:
        return (
          <div className="panel-body">
            <div className="panel-row">当前：{label}</div>
            <div className="panel-row" style={{ color: '#8c8c8c' }}>暂无特定提示</div>
          </div>
        );
    }
  }, [moduleKey, moduleLabel, storeProgress, panel, actions, currentLabel, progressPercent]);

  return (
    <>
      <div
        ref={btnRef}
        className={className}
        style={style}
        role="button"
        aria-label="智能助手"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <span>{renderIcon}</span>
      </div>
      {active && panelPos && (
        <div
          id="assistant-mini-panel"
          className="assistant-mini-panel"
          style={{ position: 'fixed', left: panelPos.left, top: panelPos.top }}
        >
          <div className="panel-header">
            <span className="panel-title">🎓 智能助手</span>
          </div>
          {renderModulePanel()}
          <div className="panel-arrow" />
        </div>
      )}
    </>
  );
};

export default FloatingAssistantButton;
