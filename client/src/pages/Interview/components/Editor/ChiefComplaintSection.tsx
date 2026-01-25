import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, AutoComplete, Row, Col, Typography, Card, Space } from 'antd';
import type { FormInstance } from 'antd';

const { Title, Text } = Typography;

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
  const lastAutoRef = useRef<string>('');
  const ccSymptom = Form.useWatch(['chiefComplaint', 'symptom'], form);
  const ccDurationNum = Form.useWatch(['chiefComplaint', 'durationNum'], form);
  const ccDurationUnit = Form.useWatch(['chiefComplaint', 'durationUnit'], form);
  
  const handleSymptomSearch = (value: string) => {
    if (!value) {
        setSymptomOptionsState([]);
        return;
    }
    const filtered = symptomOptions.filter(opt => opt.value.includes(value));
    setSymptomOptionsState(filtered.map(f => ({ value: f.value })));
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
