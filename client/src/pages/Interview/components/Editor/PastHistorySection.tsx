import React from 'react';
import { Form, Checkbox, Input, Row, Col, Typography, Card, InputNumber, Radio, Space } from 'antd';
import type { FormInstance } from 'antd';

const { Title } = Typography;
const { TextArea } = Input;

const commonDiseases = [
  '高血压', '糖尿病', '冠心病', '脑卒中', '慢性阻塞性肺疾病(COPD)', 
  '哮喘', '肝炎', '结核', '肾脏疾病', '恶性肿瘤'
];

interface PastHistorySectionProps {
  form: FormInstance;
}

const PastHistorySection: React.FC<PastHistorySectionProps> = ({ form }) => {
  const selectedDiseases = Form.useWatch(['pastHistory', 'pmh_diseases'], form) || [];
  return (
    <div>
      <Title level={5}>既往史 (Past Medical History)</Title>
      
      <Card type="inner" title="1. 既往健康状况" size="small" style={{ marginBottom: 16 }}>
        <Form.Item name={['pastHistory', 'pmh_diseases']} label="既往疾病">
           <Checkbox.Group style={{ width: '100%' }}>
               <Row gutter={[8, 8]}>
                    {commonDiseases.map(d => (
                        <Col xs={24} sm={12} key={d}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                               <Checkbox value={d}>{d}</Checkbox>
                               {selectedDiseases.includes(d) && (
                                   <Form.Item
                                       name={['pastHistory', 'diseaseRemarks', d]}
                                       noStyle
                                   >
                                       <Input 
                                           style={{ 
                                               border: 'none', 
                                               borderBottom: '1px solid #8c8c8c', 
                                               borderRadius: 0, 
                                               width: 160, 
                                               marginLeft: 8,
                                               padding: '0 4px',
                                               background: 'transparent',
                                               fontSize: 13,
                                               color: '#262626'
                                           }} 
                                           placeholder="备注信息"
                                       />
                                   </Form.Item>
                               )}
                           </div>
                       </Col>
                   ))}
               </Row>
           </Checkbox.Group>
        </Form.Item>
        <Form.Item name={['pastHistory', 'pmh_other']} label="其他疾病">
            <Input placeholder="如有其他疾病，请补充" />
        </Form.Item>
        
        {selectedDiseases.includes('高血压') && (
          <Card type="inner" title="高血压补充" size="small" style={{ marginTop: 8 }}>
             <Row gutter={16}>
              <Col span={8}>
                <Form.Item name={['pastHistory', 'hypertension', 'systolic']} label="收缩压">
                   <Space.Compact style={{ width: '100%' }}>
                      <InputNumber style={{ width: '100%' }} min={60} max={260} />
                      <span style={{ padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, lineHeight: '32px', background: '#fafafa' }}>mmHg</span>
                   </Space.Compact>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['pastHistory', 'hypertension', 'diastolic']} label="舒张压">
                   <Space.Compact style={{ width: '100%' }}>
                      <InputNumber style={{ width: '100%' }} min={40} max={160} />
                      <span style={{ padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, lineHeight: '32px', background: '#fafafa' }}>mmHg</span>
                   </Space.Compact>
                </Form.Item>
              </Col>
             </Row>
             <Row gutter={16}>
               <Col span={8}>
                 <Form.Item name={['pastHistory', 'hypertension', 'isOnMeds']} label="是否用药" initialValue="否">
                    <Radio.Group>
                      <Radio value="是">是</Radio>
                      <Radio value="否">否</Radio>
                    </Radio.Group>
                 </Form.Item>
               </Col>
               <Col span={8}>
                 <Form.Item name={['pastHistory', 'hypertension', 'drugName']} label="药物名称">
                    <Input placeholder="如：氢氯噻嗪/缬沙坦等" />
                 </Form.Item>
               </Col>
               <Col span={8}>
                 <Form.Item name={['pastHistory', 'hypertension', 'dose']} label="剂量">
                    <Input placeholder="如：10mg qd" />
                 </Form.Item>
               </Col>
             </Row>
             <Form.Item name={['pastHistory', 'hypertension', 'frequency']} label="用药规律">
                <Input placeholder="如：规律/间断/停药" />
             </Form.Item>
             <Form.Item name={['pastHistory', 'hypertension', 'notes']} label="备注">
                <TextArea rows={2} placeholder="随访、并发症、生活方式、家族史等补充" />
             </Form.Item>
          </Card>
        )}
      </Card>

      <Card type="inner" title="2. 手术与外伤史" size="small" style={{ marginBottom: 16 }}>
          <Form.Item name={['pastHistory', 'pmh_trauma_surgery']} label="手术/外伤记录">
             <TextArea rows={3} placeholder="格式：时间 + 手术/外伤名称 + 恢复情况&#10;示例：2010年行阑尾切除术，愈合良好" />
          </Form.Item>
      </Card>

      <Card type="inner" title="3. 过敏史 (突出显示)" size="small" style={{ marginBottom: 16, border: '1px solid #ffccc7' }}>
          <Form.Item name={['pastHistory', 'pmh_allergies']} label="药物/食物过敏">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name={['pastHistory', 'hasAllergy']} noStyle initialValue="no">
                     <RadioGroupWrapper />
                 </Form.Item>
              </Space.Compact>
          </Form.Item>
          <Form.Item name={['pastHistory', 'allergyDetails']} label="过敏详细描述">
             <TextArea placeholder="如有过敏，请详细描述过敏原及反应" />
          </Form.Item>
      </Card>
      
      <Card type="inner" title="4. 预防接种史" size="small">
          <Form.Item name={['pastHistory', 'pmh_vaccination']} label="接种记录">
              <TextArea placeholder="按规定接种 / 具体的接种记录" />
          </Form.Item>
      </Card>
      
      <Card type="inner" title="5. 传染病/地方病" size="small" style={{ marginTop: 16 }}>
          <Form.Item name={['pastHistory', 'pmh_infectious']} label="传染病/地方病">
              <TextArea rows={2} placeholder="如：乙肝、结核、疟疾、地方病史" />
          </Form.Item>
      </Card>
    </div>
  );
};

// Helper component for radio group to avoid typescript error in render
interface RadioGroupProps {
  value?: 'yes' | 'no';
  onChange?: (v: 'yes' | 'no') => void;
}
const RadioGroupWrapper: React.FC<RadioGroupProps> = ({ value, onChange }) => {
    return (
        <div style={{ marginBottom: 8 }}>
            <Checkbox checked={value === 'yes'} onChange={e => onChange?.(e.target.checked ? 'yes' : 'no')}>
                <span style={{ color: value === 'yes' ? 'red' : 'inherit', fontWeight: value === 'yes' ? 'bold' : 'normal' }}>
                    有无过敏史 (勾选表示有)
                </span>
            </Checkbox>
        </div>
    )
}

export default PastHistorySection;
