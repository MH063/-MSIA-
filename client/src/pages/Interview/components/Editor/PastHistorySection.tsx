import React, { useEffect } from 'react';
import { Form, Checkbox, Input, Row, Col, Typography, Card, Radio, Space, Tag, Collapse } from 'antd';
import type { RadioChangeEvent } from 'antd/es/radio/interface';
import type { FormInstance } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
// 使用 Collapse items API，避免 rc-collapse children 警告

const commonDiseases = [
  '高血压', '糖尿病', '冠心病', '脑卒中', '慢性阻塞性肺疾病(COPD)', 
  '哮喘', '肝炎', '结核', '肾脏疾病', '恶性肿瘤'
];

interface PastHistorySectionProps {
  form: FormInstance;
}

const PastHistorySection: React.FC<PastHistorySectionProps> = ({ form }) => {
  const EMPTY_ARR = React.useMemo<string[]>(() => [], []);
  type DiseaseDetail = { year?: number; control?: string; medication?: string };
  const EMPTY_OBJ = React.useMemo<Record<string, DiseaseDetail>>(() => ({}), []);
  const selectedDiseases = Form.useWatch(['pastHistory', 'pmh_diseases'], form) || EMPTY_ARR;
  const diseaseDetails: Record<string, DiseaseDetail> = Form.useWatch(['pastHistory', 'diseaseDetails'], form) || EMPTY_OBJ;
  const hasAllergy = Form.useWatch(['pastHistory', 'hasAllergy'], form);
  const allergyDetails = Form.useWatch(['pastHistory', 'allergyDetails'], form);
  // const hasSurgery = Form.useWatch(['pastHistory', 'surgeryHistory'], form);
  // const surgeryHistory = Form.useWatch(['pastHistory', 'surgeryHistoryStructured'], form);

  // 实时同步结构化数据到 illnessHistory 字符串字段
  useEffect(() => {
    const parts: string[] = [];
    
    // 1. 常见疾病
    if (selectedDiseases.length > 0) {
        const diseaseTexts = selectedDiseases.map((d: string) => {
            const details = diseaseDetails[d];
            let detailStr = '';
            if (details) {
                const info = [];
                if (details.year) info.push(`确诊${details.year}年`);
                if (details.control) info.push(`控制${details.control}`);
                if (details.medication) info.push(`用药：${details.medication}`);
                if (info.length > 0) detailStr = `（${info.join('，')}）`;
            }
            return `${d}${detailStr}`;
        });
        parts.push(`既往患有：${diseaseTexts.join('；')}。`);
    }

    // 2. 补充说明
    const other = form.getFieldValue(['pastHistory', 'pmh_other']);
    if (other) parts.push(`其他疾病：${other}。`);

    if (parts.length > 0) {
        const next = parts.join('\n');
        const prev = form.getFieldValue(['pastHistory', 'illnessHistory']);
        if (prev !== next) {
            form.setFieldValue(['pastHistory', 'illnessHistory'], next);
        }
    }
  }, [selectedDiseases, diseaseDetails, form]);

  // 实时同步过敏史
  useEffect(() => {
      if (hasAllergy === 'yes' && allergyDetails) {
          const next = `对${allergyDetails}过敏。`;
          const prev = form.getFieldValue(['pastHistory', 'allergyHistory']);
          if (prev !== next) {
              form.setFieldValue(['pastHistory', 'allergyHistory'], next);
          }
      } else if (hasAllergy === 'no') {
          const next = '否认药物及食物过敏史。';
          const prev = form.getFieldValue(['pastHistory', 'allergyHistory']);
          if (prev !== next) {
              form.setFieldValue(['pastHistory', 'allergyHistory'], next);
          }
      }
  }, [hasAllergy, allergyDetails, form]);

  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>既往史 (Past Medical History)</Title>
      
      {/* 隐藏的实际存储字段，由下方结构化表单自动填充 */}
      <Form.Item name={['pastHistory', 'illnessHistory']} hidden><Input /></Form.Item>
      <Form.Item name={['pastHistory', 'allergyHistory']} hidden><Input /></Form.Item>

      {/* 1. 既往健康状况 */}
      <Card type="inner" title="1. 既往健康状况" size="small" style={{ marginBottom: 24 }}>
        <Form.Item name={['pastHistory', 'pmh_diseases']} label="常见疾病 (多选)">
           <Checkbox.Group style={{ width: '100%' }}>
               <Row gutter={[16, 16]}>
                    {commonDiseases.map(d => (
                        <Col span={8} key={d}>
                            <Checkbox value={d}>{d}</Checkbox>
                        </Col>
                    ))}
               </Row>
           </Checkbox.Group>
        </Form.Item>
        
        {selectedDiseases.length > 0 && (
            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 24 }}>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>详细情况补充：</Text>
                {selectedDiseases.map((d: string) => (
                    <div key={d} style={{ marginBottom: 12, borderBottom: '1px dashed #d9d9d9', paddingBottom: 12 }}>
                        <Tag color="blue" style={{ marginBottom: 8 }}>{d}</Tag>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item name={['pastHistory', 'diseaseDetails', d, 'year']} label="确诊年限" noStyle>
                                    <Input placeholder="如：10" suffix="年" style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name={['pastHistory', 'diseaseDetails', d, 'control']} label="控制情况" noStyle>
                                <SelectPlaceholder options={['良好', '一般', '差']} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name={['pastHistory', 'diseaseDetails', d, 'medication']} label="用药" noStyle>
                                    <Input placeholder="当前用药" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                ))}
            </div>
        )}

        <Form.Item name={['pastHistory', 'pmh_other']} label="其他疾病">
            <Input placeholder="如有其他罕见病或补充，请填写" />
        </Form.Item>
      </Card>

      {/* 2. 过敏史 */}
      <Card 
        type="inner" 
        title={<Space><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> <span style={{ color: '#ff4d4f' }}>2. 过敏史 (重要)</span></Space>} 
        size="small" 
        style={{ marginBottom: 24, border: '1px solid #ffccc7', background: '#fff1f0' }}
      >
          <Form.Item name={['pastHistory', 'hasAllergy']} label="有无过敏史" initialValue="no">
             <Radio.Group>
                 <Radio value="no">否认</Radio>
                 <Radio value="yes" style={{ color: '#ff4d4f', fontWeight: 'bold' }}>有过敏史</Radio>
             </Radio.Group>
          </Form.Item>
          
          {hasAllergy === 'yes' && (
              <Form.Item 
                name={['pastHistory', 'allergyDetails']} 
                label="过敏原及反应" 
                rules={[{ required: true, message: '请填写过敏详情' }]}
              >
                 <TextArea rows={2} placeholder="例如：青霉素（皮疹）、芒果（喉头水肿）" />
              </Form.Item>
          )}
      </Card>

      {/* 3. 手术与外伤 */}
      <Collapse 
        defaultActiveKey={['1']}
        items={[
          {
            key: '1',
            label: '3. 手术、外伤及输血史',
            children: (
              <Form.Item name={['pastHistory', 'surgeryHistory']} label="记录">
                <TextArea rows={3} placeholder="格式：时间 + 事件 + 结果&#10;示例：2015年因'胆囊结石'行'腹腔镜胆囊切除术'，无输血，术后恢复顺利。" />
              </Form.Item>
            )
          }
        ]}
      />
    </div>
  );
};

// Helper for Select inside Input structure
interface SelectPlaceholderProps {
  options: string[];
  value?: string;
  onChange?: (e: RadioChangeEvent) => void;
}
const SelectPlaceholder = ({ options, value, onChange }: SelectPlaceholderProps) => (
    <Radio.Group value={value} onChange={onChange} size="small">
        {options.map((o: string) => <Radio.Button key={o} value={o}>{o}</Radio.Button>)}
    </Radio.Group>
);

export default PastHistorySection;
