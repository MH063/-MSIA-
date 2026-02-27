import React from 'react';
import { Form, Input, Typography, Card, Select } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const SpecialistSection: React.FC = () => {
  return (
    <div className="section-container">
      <Title level={4} style={{ 
        marginBottom: 24, 
        fontWeight: 600,
        color: 'var(--msia-text-primary)',
        letterSpacing: 0.5,
        paddingBottom: 12,
        borderBottom: '2px solid var(--msia-primary)',
        display: 'inline-block',
      }}>专科情况 <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--msia-text-tertiary)', marginLeft: 8 }}>Specialist Examination</span></Title>
      
      <Card type="inner" title={<span style={{ fontWeight: 600, color: 'var(--msia-text-secondary)' }}>【专科检查】</span>} size="small">
        <div style={{ marginBottom: 16 }}>
            <Text type="secondary">请根据具体科室要求记录专科检查情况。</Text>
        </div>
        
        <Form.Item name={['physicalExam', 'specialistDepartment']} label="科室分类">
             <Select placeholder="选择科室模板(可选)" allowClear>
                 <Option value="internal">内科通用</Option>
                 <Option value="surgery">外科通用</Option>
                 <Option value="pediatrics">儿科</Option>
                 <Option value="gynecology">妇产科</Option>
                 <Option value="ent">耳鼻喉科</Option>
                 <Option value="ophthalmology">眼科</Option>
                 <Option value="stomatology">口腔科</Option>
                 <Option value="dermatology">皮肤科</Option>
             </Select>
        </Form.Item>

        <Form.Item
          name={['physicalExam', 'specialist']}
          label="检查描述"
          rules={[{ required: true, message: '请填写专科检查描述' }]}
        >
            <TextArea 
                rows={10} 
                placeholder="记录专科检查的阳性体征及有意义的阴性体征..." 
                showCount 
                maxLength={2000} 
            />
        </Form.Item>
      </Card>
    </div>
  );
};

export default SpecialistSection;
