import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, AutoComplete, Row, Col, Typography, Card, Space, Button, message, Tag, Radio, InputNumber } from 'antd';
import { RobotOutlined, BulbOutlined, EditOutlined, SoundOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import api, { unwrapData } from '../../../../utils/api';
import type { ApiResponse } from '../../../../utils/api';

const { Title, Text, Paragraph } = Typography;
const { Search, TextArea } = Input;

const symptomOptions = [
  { value: '发热', label: '发热' },
  { value: '头痛', label: '头痛' },
  { value: '咳嗽', label: '咳嗽' },
  { value: '咳痰', label: '咳痰' },
  { value: '腹痛', label: '腹痛' },
  { value: '胸痛', label: '胸痛' },
  { value: '呼吸困难', label: '呼吸困难' },
  { value: '心悸', label: '心悸' },
  { value: '恶心呕吐', label: '恶心呕吐' },
  { value: '腹泻', label: '腹泻' },
  { value: '乏力', label: '乏力' },
];

const durationUnits = [
  { value: '小时', label: '小时' },
  { value: '天', label: '天' },
  { value: '周', label: '周' },
  { value: '月', label: '月' },
  { value: '年', label: '年' },
];

interface ChiefComplaintSectionProps {
  form: FormInstance;
}

const ChiefComplaintSection: React.FC<ChiefComplaintSectionProps> = ({ form }) => {
  const [symptomOptionsState, setSymptomOptionsState] = useState<{value: string}[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [inputMode, setInputMode] = useState('free'); // free, example, voice
  const lastAutoRef = useRef<string>('');
  
  const ccSymptom = Form.useWatch(['chiefComplaint', 'symptom'], form);
  const ccDurationNum = Form.useWatch(['chiefComplaint', 'durationNum'], form);
  const ccDurationUnit = Form.useWatch(['chiefComplaint', 'durationUnit'], form);
  
  const assocKeysMap: Record<string, string> = {
    '发热': 'fever',
    '恶心呕吐': 'nausea',
    '腹泻': 'diarrhea',
    '咳嗽': 'cough',
    '咳痰': 'sputum',
    '胸痛': 'chest_pain',
    '头痛': 'headache',
    '眩晕': 'dizziness',
    '咯血': 'hemoptysis',
    '上消化道出血': 'hematemesis',
    '心悸': 'palpitation',
    '呼吸困难': 'dyspnea'
  };
  
  const handleSymptomSearch = (value: string) => {
    if (!value) {
        setSymptomOptionsState([]);
        return;
    }
    const filtered = symptomOptions.filter(opt => opt.value.includes(value));
    setSymptomOptionsState(filtered.map(f => ({ value: f.value })));
  };

  /**
   * 智能识别主诉文本并填充结构化字段
   * 输入自然语言文本，调用后端 NLP 接口，使用统一解包处理双层 data 结构，
   * 将识别到的主症状、伴随症状及时长写入表单并提示缺失映射
   */
  const handleSmartAnalyze = async (text: string) => {
    if (!text) return;
    setAnalyzing(true);
    try {
      type AnalyzeResData = {
        matchedSymptoms: { name: string; key: string; knowledge: unknown | null }[];
        duration: { value: number | null; unit: string | null };
        normalizedComplaint: string;
        originalText: string;
        validation: { inputSymptoms: string[]; mappedKeys: string[]; missingKnowledge: string[]; consistent: boolean };
        matchedCount: number;
        perSymptomDurations: { name: string; value: number; unit: string }[];
        normalizationSafe: boolean;
      };
      const res = await api.post('/nlp/analyze', { text }) as ApiResponse<AnalyzeResData | { data: AnalyzeResData }>;
      const payload = unwrapData<AnalyzeResData>(res);
      if (res.success && payload) {
        const { matchedSymptoms, duration, validation, originalText, perSymptomDurations, normalizationSafe } = payload;
        const updates: Partial<{ symptom: string; durationNum: number; durationUnit: string; text: string }> = {};
        if (Array.isArray(matchedSymptoms) && matchedSymptoms.length > 0) {
          const mainName = matchedSymptoms[0].name;
          updates.symptom = mainName;
          const assoc = matchedSymptoms.slice(1).map((m) => m.name);
          const assocKeys = assoc.map(n => assocKeysMap[n]).filter(Boolean);
          const prevAssoc = form.getFieldValue(['presentIllness', 'associatedSymptoms']) || [];
          const mergedAssoc = Array.from(new Set([...(prevAssoc || []), ...assocKeys]));
          form.setFieldsValue({
            presentIllness: {
              ...form.getFieldValue('presentIllness'),
              associatedSymptoms: mergedAssoc
            }
          });
          message.success(`已识别症状: ${matchedSymptoms.map((m) => m.name).join('、')}`);
        } else {
          message.info('未识别到明确症状，请手动填写');
        }
        const mainSymptom = updates.symptom;
        if (normalizationSafe) {
          if (mainSymptom) {
            const durForMain = (perSymptomDurations || []).find(d => d.name === mainSymptom);
            if (durForMain) {
              updates.durationNum = durForMain.value;
              updates.durationUnit = durForMain.unit || '天';
            } else if (duration && duration.value && matchedSymptoms.length === 1) {
              updates.durationNum = duration.value;
              updates.durationUnit = duration.unit || '天';
            }
          } else if (duration && duration.value && matchedSymptoms.length === 1) {
            updates.durationNum = duration.value;
            updates.durationUnit = duration.unit || '天';
          }
        } else {
          message.warning('检测到多段时长，已保留原始主诉，请手动核对语序与时长');
        }
        updates.text = originalText || text;
        if (Object.keys(updates).length > 0) {
          form.setFieldsValue({
            chiefComplaint: {
              ...form.getFieldValue('chiefComplaint'),
              ...updates
            }
          });
        }
        if (validation && validation.consistent === false) {
          const missing = Array.isArray(validation.missingKnowledge) ? validation.missingKnowledge : [];
          if (missing.length > 0) {
            message.warning(`以下症状暂无知识库映射: ${missing.join('、')}`);
          }
        }
        console.log('[ChiefComplaintSection] 智能识别结果', payload);
      }
    } catch (error) {
      console.error(error);
      message.error('智能识别失败');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    const hasAll = ccSymptom && ccDurationNum && ccDurationUnit;
    const next = hasAll ? `${ccSymptom}${ccDurationNum}${ccDurationUnit}` : '';
    const current = form.getFieldValue(['chiefComplaint', 'text']) as string | undefined;
    if (hasAll && current !== next) {
      form.setFieldsValue({ chiefComplaint: { text: next } });
      lastAutoRef.current = next;
      console.log('[ChiefComplaintSection] 自动生成主诉', next);
    }
  }, [ccSymptom, ccDurationNum, ccDurationUnit, form]);

  const examples = [
    '转移性右下腹痛1天',
    '反复头晕头痛3年，加重2天',
    '活动后心悸气促5年'
  ];

  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>主诉 (Chief Complaint)</Title>
      
      {/* 1. 智能识别区 */}
      <Card type="inner" title="【智能识别区】" size="small" style={{ marginBottom: 24 }}>
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          请输入患者主诉，系统将自动提取症状和时间。支持自然语言输入。
        </Paragraph>
        <Search
            placeholder="请输入患者主诉描述（例如：发热伴咳嗽3天）"
            enterButton={<Button type="primary" icon={<RobotOutlined />} loading={analyzing}>智能识别</Button>}
            onSearch={handleSmartAnalyze}
            size="large"
            style={{ marginBottom: 16 }}
        />
        
        {/* 练习模式选择 */}
                <div style={{ marginBottom: 16 }}>
            <Space>
                <Text strong>练习模式：</Text>
                <Radio.Group value={inputMode} onChange={e => setInputMode(e.target.value)} size="small">
                    <Radio.Button value="free"><EditOutlined /> 自由填写</Radio.Button>
                    <Radio.Button value="example"><BulbOutlined /> 示例改写</Radio.Button>
                    <Radio.Button value="voice" disabled title="暂未开放"><SoundOutlined /> 语音输入</Radio.Button>
                </Radio.Group>
            </Space>
        </div>

        {/* 示例库 */}
        {inputMode === 'example' && (
            <div style={{ background: '#fafafa', padding: 12, borderRadius: 4, marginBottom: 16 }}>
                <Text type="secondary" style={{ marginRight: 8 }}>示例库：</Text>
                <Space wrap>
                    {examples.map(ex => (
                        <Tag 
                            key={ex} 
                            color="blue" 
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                                form.setFieldsValue({ chiefComplaint: { text: ex } });
                                handleSmartAnalyze(ex);
                            }}
                        >
                            {ex}
                        </Tag>
                    ))}
                </Space>
            </div>
        )}
      </Card>

      {/* 2. 结构化填写 */}
      <Card type="inner" title="【结构化填写】" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={12}>
             <Form.Item
               name={['chiefComplaint', 'symptom']}
               label="主要症状"
               rules={[{ required: true, message: '请输入主要症状' }]}
               help="核心症状，如：发热、腹痛"
             >
               <AutoComplete
                 options={symptomOptionsState}
                 onSearch={handleSymptomSearch}
                 placeholder="输入症状关键词"
               />
             </Form.Item>
          </Col>
          <Col span={12}>
              <Form.Item label="持续时间" required style={{ marginBottom: 0 }}>
                  <Space.Compact style={{ width: '100%' }}>
                      <Form.Item
                          name={['chiefComplaint', 'durationNum']}
                          noStyle
                          rules={[
                            { required: true, message: '请输入数字' },
                            {
                              validator: (_rule, value) => {
                                const v = value as number | undefined;
                                if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
                                  return Promise.resolve();
                                }
                                return Promise.reject(new Error('请输入数字'));
                              }
                            }
                          ]}
                      >
                          <InputNumber placeholder="数字" min={1} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item
                          name={['chiefComplaint', 'durationUnit']}
                          noStyle
                          rules={[{ required: true, message: '请选择单位' }]}
                      >
                           <AutoComplete
                              placeholder="单位"
                              options={durationUnits}
                           />
                      </Form.Item>
                  </Space.Compact>
              </Form.Item>
              <div style={{ lineHeight: '1.5', minHeight: '22px', margin: '0 0 24px', clear: 'both', color: 'rgba(0, 0, 0, 0.45)', fontSize: '14px' }}>
                精确的时间，如：3天
              </div>
          </Col>
          <Col span={24}>
              <div style={{ lineHeight: '1.5', minHeight: '22px', margin: '0 0 24px', clear: 'both', color: 'rgba(0, 0, 0, 0.45)', fontSize: '14px' }}>
                精确的时间，如：3天
              </div>
          </Col>
        </Row>
      </Card>

      {/* 3. 完整主诉 */}
      <Card type="inner" title="【完整主诉】" size="small">
        <Form.Item
          name={['chiefComplaint', 'text']}
          noStyle
        >
          <TextArea 
            rows={3} 
            placeholder="最终生成的完整主诉..." 
            style={{ fontSize: '16px' }}
          />
        </Form.Item>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
             <Space>
                 <Button onClick={() => form.setFieldValue(['chiefComplaint', 'text'], '')}>清空</Button>
                 <Button type="primary" onClick={() => handleSmartAnalyze(form.getFieldValue(['chiefComplaint', 'text']))}>重新识别</Button>
             </Space>
        </div>
      </Card>
    </div>
  );
};

export default ChiefComplaintSection;
