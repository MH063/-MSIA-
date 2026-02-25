import React from 'react';
import { App as AntdApp, Typography, Collapse, Tag, Empty, theme } from 'antd';
import { BulbOutlined, QuestionCircleOutlined, MedicineBoxOutlined, RobotOutlined } from '@ant-design/icons';
import { useAssistantStore } from '../../../../store/assistant.store';
import { useThemeStore } from '../../../../store/theme.store';
import Loading from '../../../../components/common/Loading';
import logger from '../../../../utils/logger';

const { Title, Text } = Typography;

/**
 * KnowledgeTab
 * 知识库Tab内容：集成原 KnowledgePanel 的核心功能；通过全局状态管理获取数据，统一在 Session.tsx 中调用 API
 */
const KnowledgeTab: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { token } = theme.useToken();
  const { mode } = useThemeStore();
  const knowledge = useAssistantStore(s => s.knowledge);
  const actions = useAssistantStore(s => s.actions);
  
  const SYMPTOM_ICON_MAP: Record<string, { emoji: string; bg: string; ring: string }> = React.useMemo(() => {
    const isDark = mode === 'dark';
    // Define custom colors for dark/light modes
    const purpleBg = isDark ? '#22075e' : '#f9f0ff';
    const purpleBorder = isDark ? '#722ed1' : '#d3adf7';
    const cyanBg = isDark ? '#002329' : '#e6fffb';
    const cyanBorder = isDark ? '#13c2c2' : '#87e8de';

    return {
    fever: { emoji: '🌡️', bg: token.colorErrorBg, ring: token.colorErrorBorder },
    cough_and_expectoration: { emoji: '🤧', bg: token.colorInfoBg, ring: token.colorInfoBorder },
    diarrhea: { emoji: '💩', bg: token.colorWarningBg, ring: token.colorWarningBorder },
    nausea_vomiting: { emoji: '🤮', bg: token.colorWarningBg, ring: token.colorWarningBorder },
    dyspnea: { emoji: '😮‍💨', bg: token.colorInfoBg, ring: token.colorInfoBorder },
    vertigo: { emoji: '🌀', bg: purpleBg, ring: purpleBorder },
    edema: { emoji: '💧', bg: cyanBg, ring: cyanBorder },
    depression: { emoji: '🧠', bg: token.colorFillTertiary, ring: token.colorBorder },
    hematemesis: { emoji: '🩸', bg: token.colorErrorBg, ring: token.colorErrorBorder },
    jaundice: { emoji: '🟡', bg: token.colorWarningBg, ring: token.colorWarningBorder },
    lumbodorsalgia: { emoji: '🦴', bg: token.colorWarningBg, ring: token.colorWarningBorder },
    arthralgia: { emoji: '🦵', bg: token.colorWarningBg, ring: token.colorWarningBorder },
    dysphagia: { emoji: '🥄', bg: token.colorInfoBg, ring: token.colorInfoBorder },
    hemoptysis: { emoji: '🩸', bg: token.colorErrorBg, ring: token.colorErrorBorder },
    urinary_frequency_urgency_dysuria: { emoji: '🚽', bg: token.colorInfoBg, ring: token.colorInfoBorder },
    urinary_incontinence: { emoji: '💧', bg: cyanBg, ring: cyanBorder },
    emaciation: { emoji: '🥀', bg: token.colorFillTertiary, ring: token.colorBorder },
    hematochezia: { emoji: '🩸', bg: token.colorErrorBg, ring: token.colorErrorBorder },
  }}, [token, mode]);

  const isDark = mode === 'dark';
  const purpleColor = isDark ? '#d3adf7' : '#722ed1';
  
  const { 
    context: symptomContext, 
    contexts = [],
    diagnosisSuggestions = [], 
    loading = false,
    nameToKey = {},
    keyToName = {}
  } = knowledge;
  
  const mapToName = (s: string): string => {
    if (!s) return '';
    return keyToName[s] || s;
  };
  
  const handleAddRelated = (s: string): void => {
    const key = nameToKey[s] || (keyToName[s] ? s : s.toLowerCase().replace(/\s+/g, '_'));
    if (key && typeof key === 'string' && key.trim() && actions.addAssociatedFromKnowledge) {
      actions.addAssociatedFromKnowledge(key);
      message.success(`已添加伴随症状：${mapToName(s)}`);
      
    } else {
      logger.warn('[KnowledgeTab] 添加伴随症状失败：无效键', { source: s });
    }
  };
  
  const activeContexts: Array<NonNullable<typeof symptomContext>> = (() => {
    const arr = Array.isArray(contexts) ? contexts.filter(Boolean) as typeof contexts : [];
    if (arr.length > 0) return arr as Array<NonNullable<typeof symptomContext>>;
    return symptomContext && symptomContext.name ? [symptomContext] as Array<NonNullable<typeof symptomContext>> : [];
  })();

  if (activeContexts.length === 0) {
    return (
      <div style={{ padding: '0 16px 16px', textAlign: 'center' }}>
        <Empty description="请先选择或填写症状以获取动态提示" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }
  
  const currentKeys = activeContexts.map(c => nameToKey[c.name] || c.name);
  const currentNames = activeContexts.map(c => mapToName(c.name));
  const icon = SYMPTOM_ICON_MAP[currentKeys[0]] || { emoji: '🩺', bg: token.colorFillTertiary, ring: token.colorBorder };

  const union = <T extends string>(lists: Array<T[] | undefined>): T[] => {
    const set = new Set<T>();
    for (const l of lists) {
      (l || []).forEach((x) => {
        const t = String(x || '').trim();
        if (t) set.add(t as T);
      });
    }
    return Array.from(set);
  };

  const relatedSource = union(activeContexts.map(c => c.relatedSymptoms));
  const physicalDisplay = union(activeContexts.map(c => c.physicalSigns)).map(mapToName);
  const redFlagsDisplay = union(activeContexts.map(c => c.redFlags)).map(mapToName);
  const requiredQuestions = union(activeContexts.map(c => c.questions)).map(mapToName);
  
  const items = [
    {
      key: 'diagnosis',
      label: (
        <span style={{ fontWeight: 'bold', color: purpleColor }}>
          <RobotOutlined /> 疑似诊断建议
        </span>
      ),
      children: (
        <div>
          {loading ? (
            <Loading height={100} />
          ) : diagnosisSuggestions.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {diagnosisSuggestions.map((d) => (
                <Tag className="msia-tag" color="purple" key={d}>{d}</Tag>
              ))}
            </div>
          ) : (
            <Text type="secondary">暂无明确匹配的诊断建议</Text>
          )}
        </div>
      )
    },
    {
      key: 'required',
      label: (
        <span style={{ fontWeight: 'bold' }}>
          <QuestionCircleOutlined /> 必问问题
        </span>
      ),
      children: (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {requiredQuestions.map((q, idx) => (
            <li key={idx}>{mapToName(q)}</li>
          ))}
        </ul>
      )
    },
    {
      key: 'physical_signs',
      label: (
        <span style={{ fontWeight: 'bold' }}>
          <MedicineBoxOutlined /> 体征提示
        </span>
      ),
      children: (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {physicalDisplay.map((sign, idx) => (
            <li key={idx}>{sign}</li>
          ))}
        </ul>
      )
    },
    {
      key: 'related',
      label: (
        <span style={{ fontWeight: 'bold' }}>
          <BulbOutlined /> 常见鉴别
        </span>
      ),
      children: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {relatedSource.map((s) => (
            <Tag 
              color="blue" 
              key={s} 
              className="msia-tag"
              style={{ cursor: 'pointer' }}
              onClick={() => handleAddRelated(s)}
            >
              {mapToName(s)}
            </Tag>
          ))}
        </div>
      )
    },
  ];
  
  return (
    <div className="knowledge-tab-content">
      {/* 当前症状上下文展示 */}
      {currentNames.length > 0 && (
        <div className="msia-filter-panel" style={{ marginBottom: 16, background: token.colorBgContainer, padding: 12, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div className="msia-icon-pill" style={{ background: icon.bg, borderColor: icon.ring, width: 34, height: 34, borderRadius: 12, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', color: token.colorText }}>
                {icon.emoji}
              </div>
              <div style={{ minWidth: 0 }}>
                <Title level={5} style={{ margin: 0, color: token.colorText }}>
                  当前症状：{currentNames.join('、')}
                </Title>
                <div style={{ marginTop: 4, color: token.colorTextSecondary, fontSize: 12 }}>
                  {activeContexts[0]?.updatedAt ? `首症状来源更新时间：${new Date(activeContexts[0].updatedAt!).toLocaleString()}` : ''}
                </div>
              </div>
            </div>
            <Tag className="msia-tag" color="processing" style={{ marginInlineEnd: 0 }}>
              {currentKeys.join('、')}
            </Tag>
          </div>
          {redFlagsDisplay && redFlagsDisplay.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text type="danger" strong>警惕征象</Text>
              <ul style={{ paddingLeft: 20, margin: '4px 0', color: token.colorError }}>
                {redFlagsDisplay.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Collapse 
        defaultActiveKey={['diagnosis', 'required', 'physical_signs', 'related']} 
        ghost 
        items={items} 
      />
    </div>
  );
};

export default KnowledgeTab;
