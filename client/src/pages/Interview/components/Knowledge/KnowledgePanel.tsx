import React, { useState, useEffect } from 'react';
import { App as AntdApp, Typography, Collapse, Tag, Empty, Spin } from 'antd';
import { BulbOutlined, QuestionCircleOutlined, MedicineBoxOutlined, LoadingOutlined, RobotOutlined } from '@ant-design/icons';
import api, { unwrapData } from '../../../../utils/api';
import type { ApiResponse } from '../../../../utils/api';
import { useQuery } from '@tanstack/react-query';

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
 * KnowledgePanelProps
 * 知识库助手属性：包含当前激活分节，已识别的症状上下文，以及加载状态
 */
interface KnowledgePanelProps {
  activeSection: string;
  loading?: boolean;
  symptomContext?: {
    name: string;
    questions?: string[];
    relatedSymptoms?: string[];
    redFlags?: string[];
    physicalSigns?: string[];
    updatedAt?: string;
  };
  patientInfo?: {
      age?: number;
      gender?: string;
  };
  sessionId?: number;
  onAddAssociated?: (key: string) => void;
}

/**
 * KnowledgePanel
 * 右侧知识库助手：根据当前有效症状，提示警惕征象、必问问题、常见鉴别，
 * 并统一渲染各系统常见症状的问诊要点
 */
const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
  activeSection,
  loading = false,
  symptomContext,
  patientInfo,
  sessionId,
  onAddAssociated
}) => {
  const { message } = AntdApp.useApp();
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<string[]>([]);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  
  /**
   * 映射加载
   * 拉取 /mapping/symptoms，构造 name→key 与 key→name 映射，确保展示中文名称且与后端键值一致
   */
  const mappingQuery = useQuery({
    queryKey: ['mapping', 'symptoms'],
    queryFn: async () => {
      const res = await api.get('/mapping/symptoms') as ApiResponse<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>;
      return res;
    }
  });
  const nameToKey = React.useMemo(() => {
    const payload = unwrapData<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>(mappingQuery.data as ApiResponse<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>);
    return payload?.nameToKey || {};
  }, [mappingQuery.data]);
  const keyToName = React.useMemo(() => {
    const mappingPayload = unwrapData<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>(mappingQuery.data as ApiResponse<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>);
    const nameToKey = mappingPayload?.nameToKey || {};
    const inverted: Record<string, string> = {};
    for (const [name, key] of Object.entries(nameToKey)) {
      if (key && name && !inverted[key]) inverted[key] = name;
    }
    return inverted;
  }, [mappingQuery.data]);

  /**
   * fetchDiagnosisSuggestions
   * 根据当前症状上下文与患者基本信息，携带会话ID调用后端诊断建议接口，
   * 统一使用 unwrapData 解包双层 data 响应结构并更新建议列表
   */
  const fetchDiagnosisSuggestions = React.useCallback(async () => {
      const validSession = typeof sessionId === 'number' && Number.isFinite(sessionId) && sessionId > 0;
      if (!symptomContext || !symptomContext.name || !validSession) return;
      setDiagnosisLoading(true);
      try {
          console.log('[Knowledge] 拉取诊断建议', { name: symptomContext.name, sessionId, patientInfo });
          const symptoms = symptomContext.name.split('、');
          const normalizedAge = (() => {
            const a = patientInfo?.age;
            if (typeof a === 'number' && Number.isFinite(a)) return Math.max(0, Math.floor(a));
            return undefined;
          })();
          const res = await api.post('/diagnosis/suggest', {
              symptoms,
              age: normalizedAge,
              gender: patientInfo?.gender,
              sessionId
          }) as import('../../../../utils/api').ApiResponse<string[] | { data: string[] }>;
          const payload = unwrapData<string[]>(res);
          if (Array.isArray(payload)) {
              setDiagnosisSuggestions(payload);
              console.log('[Knowledge] 诊断建议更新', { count: payload.length, items: payload });
          }
      } catch (error) {
          console.error("[Knowledge] 获取诊断建议失败:", error);
          message.error('诊断建议加载失败');
      } finally {
          setDiagnosisLoading(false);
      }
  }, [symptomContext, patientInfo, sessionId, message]);

  useEffect(() => {
      if (symptomContext && symptomContext.name) {
          fetchDiagnosisSuggestions();
      } else {
          setDiagnosisSuggestions([]);
      }
  }, [symptomContext, fetchDiagnosisSuggestions]);

  // 空状态提示改为引导，移除所有静态示例内容

  /**
   * renderSymptomHints
   * 当存在有效症状时，渲染红旗（警惕征象）、必问问题、常见鉴别以及通用症状要点
   */
  const renderSymptomHints = () => {
     if (!symptomContext || !symptomContext.name) {
         return (
             <div>
                <div style={{ padding: '0 16px 16px', textAlign: 'center' }}>
                   <Empty description="请先选择或填写症状以获取动态提示" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
             </div>
         );
     }

     /**
      * mapToName
      * 将后端键或名称统一映射为中文名称以展示；若映射缺失则原样返回
      */
     const mapToName = (s: string) => keyToName[s] || s;
     /**
      * handleAddRelated
      * 将“常见鉴别”标签点击事件转换为现病史伴随症状的键，并回调给父组件追加
      */
     const handleAddRelated = (s: string) => {
       const key = nameToKey[s] || (keyToName[s] ? s : s.toLowerCase().replace(/\s+/g, '_'));
       if (typeof key === 'string' && key.trim() && onAddAssociated) {
         onAddAssociated(key);
         message.success(`已添加伴随症状：${mapToName(s)}`);
         console.log('[Knowledge] 添加伴随症状', { source: s, key });
       } else {
         console.warn('[Knowledge] 添加伴随症状失败：无效键', { source: s });
       }
     };
     const currentSymptomKey = nameToKey[symptomContext.name] || symptomContext.name;
     const currentSymptomName = mapToName(symptomContext.name);
     const icon = SYMPTOM_ICON_MAP[currentSymptomKey] || { emoji: '🩺', bg: '#f0f5ff', ring: '#adc6ff' };
     const relatedSource = symptomContext.relatedSymptoms || [];
     const physicalDisplay = (symptomContext.physicalSigns || []).map(mapToName);
     const redFlagsDisplay = (symptomContext.redFlags || []).map(mapToName);
     
     const items = [
       {
         key: 'diagnosis',
         label: <span style={{ fontWeight: 'bold', color: '#722ed1' }}><RobotOutlined /> 疑似诊断建议</span>,
         children: (
            <div>
                {diagnosisLoading ? <Spin size="small" /> : (
                    diagnosisSuggestions.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {diagnosisSuggestions.map(d => <Tag className="msia-tag" color="purple" key={d}>{d}</Tag>)}
                        </div>
                    ) : <Text type="secondary">暂无明确匹配的诊断建议</Text>
                )}
            </div>
         )
       },
       {
        key: 'required',
        label: <span style={{ fontWeight: 'bold' }}><QuestionCircleOutlined /> 必问问题</span>,
        children: (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {(symptomContext.questions || []).map((q, idx) => <li key={idx}>{mapToName(q)}</li>)}
          </ul>
        )
      },
      {
        key: 'physical_signs',
        label: <span style={{ fontWeight: 'bold' }}><MedicineBoxOutlined /> 体征提示</span>,
        children: (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
             {physicalDisplay.map((sign, idx) => <li key={idx}>{sign}</li>)}
          </ul>
        )
      },
      {
        key: 'related',
         label: <span style={{ fontWeight: 'bold' }}><BulbOutlined /> 常见鉴别</span>,
         children: (
           <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
             {relatedSource.map(s => (
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
       <div>
         <div className="msia-filter-panel" style={{ marginBottom: 16, background: '#ffffff' }}>
           <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
               <div className="msia-icon-pill" style={{ background: icon.bg, borderColor: icon.ring, width: 34, height: 34, borderRadius: 12, fontSize: 18 }}>
                 {icon.emoji}
               </div>
               <div style={{ minWidth: 0 }}>
                 <Title level={5} style={{ margin: 0, color: '#10239e' }}>
                   当前症状：{currentSymptomName}
                 </Title>
                 {symptomContext.updatedAt && (
                   <div style={{ marginTop: 4, color: '#8c8c8c' }}>
                     来源更新时间：{new Date(symptomContext.updatedAt).toLocaleString()}
                   </div>
                 )}
               </div>
             </div>
             <Tag className="msia-tag" color="processing" style={{ marginInlineEnd: 0 }}>
               {currentSymptomKey}
             </Tag>
           </div>
           {redFlagsDisplay && redFlagsDisplay.length > 0 && (
             <div style={{ marginTop: 8 }}>
               <Text type="danger" strong>警惕征象：</Text>
               <ul style={{ paddingLeft: 20, margin: '4px 0', color: '#cf1322' }}>
                 {redFlagsDisplay.map((flag, idx) => <li key={idx}>{flag}</li>)}
               </ul>
             </div>
           )}
         </div>
         <Collapse defaultActiveKey={['diagnosis', 'required', 'physical_signs', 'related']} ghost items={items} />
      </div>
    );
  };

  /**
   * renderSymptomSummary
   * 统一渲染“常见症状问诊要点”各系统分组，保持样式一致
   */
  // 已移除未使用的渲染函数以通过 linter 检查
 
  const renderGeneralHints = () => {
    const items = [
      {
        key: '1',
        label: '一般项目问诊要点',
        children: (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>核对患者姓名、年龄、性别</li>
            <li>询问职业时注意与疾病的关联（如粉尘接触）</li>
            <li>籍贯和居住地可能与地方病有关</li>
            <li>确认病史陈述者的可靠性</li>
          </ul>
        )
      }
    ];
    return <Collapse items={items} defaultActiveKey={['1']} ghost />;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div style={{ marginTop: 8, color: '#8c8c8c' }}>正在加载知识库...</div>
        </div>
      );
    }
    
      switch (activeSection) {
          case 'general':
              return renderGeneralHints();
          case 'chief_complaint':
          case 'hpi':
              return renderSymptomHints();
          case 'past_history':
              return (
                  <div>
                    {/* 显示当前症状上下文（如果有），确保红旗征和体征提示在既往史中也可见 */}
                    {symptomContext && symptomContext.name && (
                         <div style={{ marginBottom: 16 }}>
                            <Title level={5}>
                                <MedicineBoxOutlined /> 关联症状提示: {symptomContext.name}
                            </Title>
                            {/* 这里复用 renderSymptomHints，但为了避免过于冗长，用户可以折叠不需要的部分 */}
                            {renderSymptomHints()}
                         </div>
                    )}
                    
                    <Collapse
                        ghost
                        defaultActiveKey={['1']}
                        items={[
                        {
                            key: '1',
                            label: '既往史问诊要点',
                            children: (
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                                <li>慢性病史（高血压/糖尿病）对现病的影响</li>
                                <li>手术史的具体时间及愈合情况</li>
                                <li>过敏史必须详细记录过敏原及反应类型</li>
                            </ul>
                            )
                        }
                        ]}
                    />
                  </div>
              );
          default:
              return <Empty description="暂无特定提示" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
      }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
            <Title level={4} style={{ margin: 0 }}>知识库助手</Title>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {renderContent()}
        </div>
    </div>
  );
};

export default KnowledgePanel;
