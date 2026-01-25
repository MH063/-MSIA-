import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, AutoComplete, Row, Col, Typography, Card, Space, Button, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import api from '../../../../utils/api';

const { Title, Text } = Typography;
const { Search } = Input;

const symptomOptions = [
  { value: '发热', label: '发热' },
  { value: '头痛', label: '头痛' },
  { value: '咳嗽', label: '咳嗽' },
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
  const lastAutoRef = useRef<string>('');
  const ccSymptom = Form.useWatch(['chiefComplaint', 'symptom'], form);
  const ccDurationNum = Form.useWatch(['chiefComplaint', 'durationNum'], form);
  const ccDurationUnit = Form.useWatch(['chiefComplaint', 'durationUnit'], form);
  const assocKeysMap: Record<string, string> = {
    '发热': 'fever',
    '恶心呕吐': 'nausea',
    '腹泻': 'diarrhea',
    '咳嗽': 'cough',
    '胸痛': 'chest_pain',
    '眩晕': 'dizziness',
    '咯血': 'hemoptysis',
    '上消化道出血': 'hematemesis'
  };
  
  const handleSymptomSearch = (value: string) => {
    if (!value) {
        setSymptomOptionsState([]);
        return;
    }
    const filtered = symptomOptions.filter(opt => opt.value.includes(value));
    setSymptomOptionsState(filtered.map(f => ({ value: f.value })));
  };

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
      const res = await api.post('/nlp/analyze', { text }) as import('../../../../utils/api').ApiResponse<AnalyzeResData>;
      if (res.success && res.data) {
        const { matchedSymptoms, duration, validation, originalText, perSymptomDurations, normalizationSafe } = res.data;
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
        console.log('[ChiefComplaintSection] 智能识别结果', res.data);
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
    const auto = hasAll ? `${ccSymptom}${ccDurationNum}${ccDurationUnit}` : '';
    const current = form.getFieldValue(['chiefComplaint', 'text']) as string | undefined;
    if (hasAll) {
      if (!current || current === lastAutoRef.current) {
        form.setFieldsValue({ chiefComplaint: { text: auto } });
        lastAutoRef.current = auto;
        console.log('[ChiefComplaintSection] 自动生成主诉', auto);
      }
    }
  }, [ccSymptom, ccDurationNum, ccDurationUnit, form]);

  return (
    <div>
      <Title level={5}>主诉 (Chief Complaint)</Title>
      
      <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
        <Space orientation="vertical" style={{ width: '100%' }}>
            <Text strong>🤖 智能识别</Text>
            <Search
                placeholder="请输入患者主诉描述（例如：发热伴咳嗽3天），点击按钮识别"
                enterButton={<Button icon={<RobotOutlined />} loading={analyzing}>识别填充</Button>}
                onSearch={handleSmartAnalyze}
            />
        </Space>
      </Card>

      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        格式：主要症状 + 持续时间 (例如：发热伴咳嗽3天)
      </Text>

      <Row gutter={16}>
        <Col span={12}>
           <Form.Item
             name={['chiefComplaint', 'symptom']}
             label="主要症状"
             rules={[{ required: true, message: '请输入主要症状' }]}
           >
             <AutoComplete
               options={symptomOptionsState}
               onSearch={handleSymptomSearch}
               placeholder="输入症状关键词 (如: 腹痛)"
             />
           </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item label="持续时间" style={{ marginBottom: 0 }}>
                <Space.Compact style={{ width: '100%' }}>
                    <Form.Item
                        name={['chiefComplaint', 'durationNum']}
                        noStyle
                        rules={[{ required: true, message: '请输入数字' }]}
                    >
                        <Input placeholder="数字" type="number" />
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
        </Col>
      </Row>

      <Form.Item
        name={['chiefComplaint', 'text']}
        label="完整主诉描述"
        help="系统将根据上述输入自动生成，也可以手动修改"
      >
        <Input.TextArea rows={2} placeholder="发热伴咳嗽3天..." />
      </Form.Item>
      
      <Card size="small" title="示例库" style={{ marginTop: 16, background: '#fafafa' }}>
         <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
             {['转移性右下腹痛1天', '反复头晕、头痛3年，加重2天', '活动后心悸、气促5年'].map(ex => (
                 <a key={ex} onClick={() => {
                     form.setFieldsValue({
                         chiefComplaint: { text: ex }
                     });
                 }}>{ex}</a>
             ))}
         </div>
      </Card>
    </div>
  );
};

export default ChiefComplaintSection;
