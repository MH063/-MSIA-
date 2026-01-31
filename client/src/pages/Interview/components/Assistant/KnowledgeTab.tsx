import React from 'react';
import { Typography, Collapse, Tag, Empty, Spin, message } from 'antd';
import { BulbOutlined, QuestionCircleOutlined, MedicineBoxOutlined, RobotOutlined } from '@ant-design/icons';
import { useAssistantStore } from '../../../../store/assistant.store';

const { Title, Text } = Typography;

/**
 * KnowledgeTab
 * 知识库Tab内容：集成原KnowledgePanel的核心功能
 * 通过全局状态管理获取数据，统一在Session.tsx中调用API
 */
const KnowledgeTab: React.FC = () => {
  const knowledge = useAssistantStore(s => s.knowledge);
  const actions = useAssistantStore(s => s.actions);
  
  const { 
    context: symptomContext, 
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
  
  if (!symptomContext?.name) {
    return (
      <div style={{ padding: '0 16px 16px', textAlign: 'center' }}>
        <Empty description="请先选择或填写症状以获取动态提示" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }
  
  const currentSymptomName = mapToName(symptomContext.name);
  const relatedSource = symptomContext.relatedSymptoms || [];
  const physicalDisplay = (symptomContext.physicalSigns || []).map(mapToName);
  const redFlagsDisplay = (symptomContext.redFlags || []).map(mapToName);
  
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
                <Tag color="purple" key={d}>{d}</Tag>
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
          {(symptomContext.questions || []).map((q, idx) => (
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
      <div style={{ 
        marginBottom: 16, 
        padding: '12px', 
        background: '#e6f7ff', 
        borderRadius: 4, 
        border: '1px solid #91d5ff' 
      }}>
        <Title level={5} style={{ marginTop: 0, color: '#0050b3' }}>
          <MedicineBoxOutlined /> 当前症状: {currentSymptomName}
        </Title>
        {symptomContext.updatedAt && (
          <div style={{ marginTop: 4, color: '#8c8c8c' }}>
            来源更新时间：{new Date(symptomContext.updatedAt).toLocaleString()}
          </div>
        )}
        {redFlagsDisplay && redFlagsDisplay.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Text type="danger" strong>警惕征象 (Red Flags):</Text>
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
