import React, { useState, useEffect, useRef } from 'react';
import { App as AntdApp, Form, Input, Row, Col, Typography, Card, Space, Button, InputNumber } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import api, { unwrapData } from '../../../../utils/api';
import type { ApiResponse } from '../../../../utils/api';
import { useQuery } from '@tanstack/react-query';
import LazyAutoComplete from '../../../../components/lazy/LazyAutoComplete';
import logger from '../../../../utils/logger';

const { Title, Paragraph } = Typography;
const { Search, TextArea } = Input;

/**
 * 主诉症状候选项来源改为后端映射，保证名称与键值一致
 */
// 映射查询需在组件内调用 Hook

const durationUnits = [
  { value: '分钟', label: '分钟' },
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
  const { message } = AntdApp.useApp();
  // 拉取后端映射，生成症状名称候选
  const mappingQuery = useQuery({
    queryKey: ['mapping', 'symptoms'],
    queryFn: async () => {
      const res = await api.get('/mapping/symptoms') as ApiResponse<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>;
      return res;
    },
    staleTime: 5 * 60 * 1000, // 5分钟内数据保持新鲜，不会重新请求
    gcTime: 10 * 60 * 1000, // 缓存保留10分钟
    refetchOnWindowFocus: false, // 窗口重新聚焦时不自动刷新
    refetchOnReconnect: false // 网络重连时不自动刷新
  });
  const mappingPayload = unwrapData<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>(mappingQuery.data as ApiResponse<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>);
  const mappingNames = mappingPayload ? Object.keys(mappingPayload.nameToKey || {}) : [];
  const [symptomOptionsState, setSymptomOptionsState] = useState<{value: string}[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [smartInputValue, setSmartInputValue] = useState('');
  const lastAutoRef = useRef<string>('');

  const ccSymptom = Form.useWatch(['chiefComplaint', 'symptom'], form);
  const ccDurationNum = Form.useWatch(['chiefComplaint', 'durationNum'], form);
  const ccDurationNumMax = Form.useWatch(['chiefComplaint', 'durationNumMax'], form);
  const ccDurationUnit = Form.useWatch(['chiefComplaint', 'durationUnit'], form);
  const ccText = Form.useWatch(['chiefComplaint', 'text'], form);
  const ccDurationRaw = Form.useWatch(['chiefComplaint', 'durationRaw'], form);
  const ccDurationKey = `${ccDurationNum ?? ''}|${ccDurationNumMax ?? ''}|${ccDurationUnit ?? ''}`;

  // 标记用户是否手动修改过完整主诉文本，避免自动覆盖
  const userModifiedTextRef = useRef<boolean>(false);
  // 记录上一次结构化字段的值，用于判断是否是结构化字段变化导致的更新
  const lastStructuredKeyRef = useRef<string>('');

  /**
   * 根据输入匹配后端映射名称列表，填充主诉症状候选项
   */
  const handleSymptomSearch = (value: string) => {
    const list = mappingNames.length > 0 ? mappingNames : [];
    const filtered = value ? list.filter(n => n.includes(value)) : list.slice(0, 50);
    setSymptomOptionsState(filtered.map(n => ({ value: n })));
  };

  /**
   * 智能识别主诉文本并填充结构化字段
   * 输入自然语言文本，调用后端 NLP 接口，使用统一解包处理双层 data 结构
   * 将识别到的主症状、伴随症状及时长写入表单并提示缺失映射
   * 识别成功后自动清空智能识别区的输入内容
   */
  const handleSmartAnalyze = async (text: string) => {
    if (!text) return;
    setAnalyzing(true);
    try {
      type DurationValue = number | { min: number; max: number };
      type ParseResData = {
        complaint_text: string;
        duration_value: DurationValue | null;
        duration_unit: string | null;
        duration_raw: string | null;
        normalized_text: string;
        confidence: number;
        failure_reason: string | null;
      };
      const res = await api.post('/nlp/chief-complaint/parse', { text }) as ApiResponse<ParseResData | { data: ParseResData }>;
      const payload = unwrapData<ParseResData>(res);
      if (res.success && payload) {
        const updates: Partial<{ symptom: string; durationNum?: number; durationNumMax?: number; durationUnit?: string; text: string; durationRaw?: string | null }> = {};
        const symptom = String(payload.complaint_text || '').trim();
        if (symptom) {
          updates.symptom = symptom;
          message.success(`已提取主诉：${symptom}`);
        } else {
          message.info('未识别到明确主诉核心描述，请手动填写');
        }

        if (payload.duration_value && payload.duration_unit) {
          if (typeof payload.duration_value === 'number') {
            updates.durationNum = payload.duration_value;
            updates.durationNumMax = undefined;
          } else {
            updates.durationNum = payload.duration_value.min;
            updates.durationNumMax = payload.duration_value.max;
          }
          updates.durationUnit = payload.duration_unit;
          updates.durationRaw = payload.duration_raw;
        } else {
          updates.durationNum = undefined;
          updates.durationNumMax = undefined;
          updates.durationUnit = undefined;
          updates.durationRaw = payload.duration_raw;
          message.warning('未识别到持续时间，请手动补充');
        }

        updates.text = text;
        form.setFieldsValue({
          chiefComplaint: {
            ...form.getFieldValue('chiefComplaint'),
            ...updates,
          },
        });

        // 识别成功后清空智能识别区的输入
        setSmartInputValue('');
        
      }
    } catch (error) {
      logger.error(error);
      message.error('智能识别失败');
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * 监听完整主诉文本的变化，检测用户是否手动修改
   * 如果用户手动修改的文本与自动生成的文本不一致，则标记为用户已修改
   */
  useEffect(() => {
    if (!ccText) return;

    const hasAll = Boolean(ccSymptom && typeof ccDurationNum === 'number' && Number.isFinite(ccDurationNum) && ccDurationUnit);
    const autoGenerated = (() => {
      if (!hasAll) return '';
      const range = ccDurationNumMax ? `${ccDurationNum}-${ccDurationNumMax}` : `${ccDurationNum}`;
      return `${ccSymptom}${range}${ccDurationUnit}`;
    })();

    // 如果当前文本与自动生成的文本不一致，说明用户手动修改了
    if (ccText !== autoGenerated && ccText !== lastAutoRef.current) {
      userModifiedTextRef.current = true;
      
    }
  }, [ccText, ccSymptom, ccDurationNum, ccDurationNumMax, ccDurationUnit]);

  /**
   * 根据结构化字段自动生成完整主诉文本
   * 只在以下情况执行：
   * 1. 结构化字段（症状、时长）发生变化
   * 2. 用户未手动修改过完整主诉文本
   * 3. 当前完整主诉为空时（初始化状态）
   */
  useEffect(() => {
    const hasAll = Boolean(ccSymptom && typeof ccDurationNum === 'number' && Number.isFinite(ccDurationNum) && ccDurationUnit);
    const next = (() => {
      if (!hasAll) return '';
      const range = ccDurationNumMax ? `${ccDurationNum}-${ccDurationNumMax}` : `${ccDurationNum}`;
      return `${ccSymptom}${range}${ccDurationUnit}`;
    })();
    const current = form.getFieldValue(['chiefComplaint', 'text']) as string | undefined;

    const structuredKey = hasAll ? `${ccSymptom}|${ccDurationKey}` : '';
    const structuredChanged = structuredKey !== lastStructuredKeyRef.current;
    if (structuredKey) {
      lastStructuredKeyRef.current = structuredKey;
    }

    // 只在结构化字段变化且用户未手动修改过文本时，才自动更新完整主诉
    if (hasAll && structuredChanged && !userModifiedTextRef.current && (!current || current === lastAutoRef.current)) {
      form.setFieldsValue({ chiefComplaint: { text: next } });
      lastAutoRef.current = next;
      
    }
  }, [ccSymptom, ccDurationKey, ccDurationNum, ccDurationNumMax, ccDurationUnit, form]);



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
            value={smartInputValue}
            onChange={(e) => setSmartInputValue(e.target.value)}
            onSearch={handleSmartAnalyze}
            size="large"
            style={{ marginBottom: 16 }}
        />


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
              <LazyAutoComplete
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
                                if (v === undefined || v === null) {
                                  return Promise.resolve();
                                }
                                if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
                                  return Promise.resolve();
                                }
                                return Promise.reject(new Error('请输入有效数字'));
                              }
                            }
                          ]}
                      >
                          <InputNumber placeholder="数字" min={0.5} step={0.5} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item
                          name={['chiefComplaint', 'durationNumMax']}
                          noStyle
                          dependencies={[['chiefComplaint', 'durationNum']]}
                          rules={[
                            {
                              validator: (_rule, value) => {
                                const maxV = value as number | undefined;
                                const minV = form.getFieldValue(['chiefComplaint', 'durationNum']) as number | undefined;
                                if (maxV === undefined || maxV === null) return Promise.resolve();
                                if (typeof maxV !== 'number' || !Number.isFinite(maxV) || maxV <= 0) {
                                  return Promise.reject(new Error('请输入有效数字'));
                                }
                                if (typeof minV === 'number' && Number.isFinite(minV) && maxV < minV) {
                                  return Promise.reject(new Error('范围上限需≥下限'));
                                }
                                return Promise.resolve();
                              }
                            }
                          ]}
                      >
                          <InputNumber placeholder="范围上限(可选)" min={0.5} step={0.5} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item
                          name={['chiefComplaint', 'durationUnit']}
                          noStyle
                          rules={[{ required: true, message: '请选择单位' }]}
                      >
                           <LazyAutoComplete
                              placeholder="单位"
                              options={durationUnits}
                           />
                      </Form.Item>
                  </Space.Compact>
              </Form.Item>
              <div className="chief-complaint-hint" style={{ 
                lineHeight: '1.5', 
                minHeight: '22px', 
                margin: '0 0 24px', 
                clear: 'both', 
                color: 'var(--msia-text-tertiary, #9CA3AF)', 
                fontSize: '13px',
                padding: '6px 10px',
                backgroundColor: 'var(--msia-bg-secondary, #F1F5F9)',
                borderRadius: 6,
                border: '1px solid var(--msia-border, #E5E7EB)'
              }}>
                {ccDurationRaw ? (
                  <>
                    <span style={{ color: 'var(--msia-primary, #0066CC)', fontWeight: 500 }}>识别片段：</span>
                    <span style={{ color: 'var(--msia-text-secondary, #4B5563)' }}>{ccDurationRaw}</span>
                  </>
                ) : '精确的时间，如：3天、2-3周'}
              </div>
          </Col>
        </Row>
      </Card>

      {/* 3. 完整主诉 */}
      <Card type="inner" title="【完整主诉】" size="small">
        <Form.Item
          name={['chiefComplaint', 'text']}
          label="完整主诉"
          help="建议不超过20字，包含主要症状及持续时间"
          rules={[
            { required: true, message: '请输入完整主诉' },
            { max: 20, message: '主诉不能超过20个字' }
          ]}
        >
          <TextArea
            rows={2}
            placeholder="如：反复咳嗽、咳痰5年，加重1周"
            style={{ fontSize: '16px' }}
            onChange={() => userModifiedTextRef.current = true}
          />
        </Form.Item>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
             <Space>
                 <Button onClick={() => {
                   form.setFieldValue(['chiefComplaint', 'text'], '');
                   userModifiedTextRef.current = false;
                 }}>清空</Button>
                 <Button type="primary" onClick={() => {
                   userModifiedTextRef.current = false;
                   handleSmartAnalyze(form.getFieldValue(['chiefComplaint', 'text']));
                 }}>重新识别</Button>
             </Space>
        </div>
      </Card>
    </div>
  );
};

export default ChiefComplaintSection;
