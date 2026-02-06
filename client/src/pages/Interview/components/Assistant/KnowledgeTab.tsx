import React from 'react';
import { App as AntdApp, Typography, Collapse, Tag, Empty, Spin } from 'antd';
import { BulbOutlined, QuestionCircleOutlined, MedicineBoxOutlined, RobotOutlined } from '@ant-design/icons';
import { useAssistantStore } from '../../../../store/assistant.store';

const { Title, Text } = Typography;

const SYMPTOM_ICON_MAP: Record<string, { emoji: string; bg: string; ring: string }> = {
  fever: { emoji: '🌡️', bg: '#fff2f0', ring: '#ffccc7' },
  cough_and_expectoration: { emoji: '🤧', bg: '#e6f7ff', ring: '#91d5ff' },
  diarrhea: { emoji: '💩', bg: '#fff7e6', ring: '#ffd591' },
  nausea_vomiting: { emoji: '🤮', bg: '#fffbe6', ring: '#ffe58f' },
  dyspnea: { emoji: '😮‍💨', bg: '#f0f5ff', ring: '#adc6ff' },
  vertigo: { emoji: '🌀', bg: '#f9f0ff', ring: '#d3adf7' },
  edema: { emoji: '💧', bg: '#e6fffb', ring: '#87e8de' },
  depression: { emoji: '🧠', bg: '#f5f5f5', ring: '#d9d9d9' },
  hematemesis: { emoji: '🩸', bg: '#fff1f0', ring: '#ffa39e' },
  jaundice: { emoji: '🟡', bg: '#fffbe6', ring: '#ffe58f' },
  lumbodorsalgia: { emoji: '🦴', bg: '#fff7e6', ring: '#ffd591' },
  arthralgia: { emoji: '🦵', bg: '#fff7e6', ring: '#ffd591' },
  dysphagia: { emoji: '🥄', bg: '#f0f5ff', ring: '#adc6ff' },
  hemoptysis: { emoji: '🩸', bg: '#fff1f0', ring: '#ffa39e' },
  urinary_frequency_urgency_dysuria: { emoji: '🚽', bg: '#e6f7ff', ring: '#91d5ff' },
  urinary_incontinence: { emoji: '💧', bg: '#e6fffb', ring: '#87e8de' },
  emaciation: { emoji: '🥀', bg: '#f5f5f5', ring: '#d9d9d9' },
  hematochezia: { emoji: '🩸', bg: '#fff1f0', ring: '#ffa39e' },
};

/**
 * KnowledgeTab
 * 知识库Tab内容：集成原KnowledgePanel的核心功能
 * 通过全局状态管理获取数据，统一在Session.tsx中调用API
 */
const KnowledgeTab: React.FC = () => {
  const { message } = AntdApp.useApp();
  const knowledge = useAssistantStore(s => s.knowledge);
  const actions = useAssistantStore(s => s.actions);
  
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
      console.log('[KnowledgeTab] 添加伴随症状', { source: s, key });
    } else {
      console.warn('[KnowledgeTab] 添加伴随症状失败：无效键', { source: s });
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
  const icon = SYMPTOM_ICON_MAP[currentKeys[0]] || { emoji: '🩺', bg: '#f0f5ff', ring: '#adc6ff' };

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
        <span style={{ fontWeight: 'bold', color: '#722ed1' }}>
          <RobotOutlined /> 疑似诊断建议
        </span>
      ),
      children: (
        <div>
          {loading ? (
            <Spin size="small" />
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
      <div className="msia-filter-panel" style={{ marginBottom: 16, background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div className="msia-icon-pill" style={{ background: icon.bg, borderColor: icon.ring, width: 34, height: 34, borderRadius: 12, fontSize: 18 }}>
              {icon.emoji}
            </div>
            <div style={{ minWidth: 0 }}>
              <Title level={5} style={{ margin: 0, color: '#10239e' }}>
                当前症状：{currentNames.join('、')}
              </Title>
              <div style={{ marginTop: 4, color: '#8c8c8c' }}>
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
            <Text type="danger" strong>警惕征象：</Text>
            <ul style={{ paddingLeft: 20, margin: '4px 0', color: '#cf1322' }}>
              {redFlagsDisplay.map((flag, idx) => (
                <li key={idx}>{flag}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <Collapse 
        defaultActiveKey={['diagnosis', 'required', 'physical_signs', 'related']} 
        ghost 
        items={items} 
      />
    </div>
  );
};

export default KnowledgeTab;
