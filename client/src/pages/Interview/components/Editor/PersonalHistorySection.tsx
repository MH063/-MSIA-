import React from 'react';
import { Form, Input, Radio, Typography, Card, Row, Col } from 'antd';

const { Title } = Typography;
const { TextArea } = Input;

const PersonalHistorySection: React.FC = () => {
  return (
    <div>
      <Title level={5}>个人史 (Personal History)</Title>
      
      <Card type="inner" title="1. 社会经历与职业" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
            <Col span={12}>
                <Form.Item name="occupation" label="职业">
                    <Input placeholder="患者职业" />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="employer" label="工作单位">
                    <Input placeholder="工作单位" />
                </Form.Item>
            </Col>
        </Row>
        <Form.Item name={['personalHistory', 'social']} label="社会经历">
            <TextArea rows={2} placeholder="出生地、居住地变迁、受教育程度等" />
        </Form.Item>
        <Form.Item name={['personalHistory', 'work_cond']} label="工作环境/接触史">
            <TextArea rows={2} placeholder="粉尘、毒物、放射性物质接触史等" />
        </Form.Item>
      </Card>

      <Card type="inner" title="2. 习惯与嗜好" size="small" style={{ marginBottom: 16 }}>
          <Form.Item name={['personalHistory', 'living_habits']} label="起居饮食">
              <Input placeholder="饮食习惯、睡眠情况等" />
          </Form.Item>
          
          <div style={{ background: '#fafafa', padding: '8px 16px', borderRadius: 4, marginBottom: 12 }}>
            <Form.Item name={['personalHistory', 'smoking_status']} label="吸烟史">
                <Radio.Group>
                    <Radio value="从不">从不吸烟</Radio>
                    <Radio value="已戒烟">已戒烟</Radio>
                    <Radio value="吸烟">吸烟</Radio>
                </Radio.Group>
            </Form.Item>
            <Form.Item 
                noStyle 
                shouldUpdate={(prev, curr) => prev?.personalHistory?.smoking_status !== curr?.personalHistory?.smoking_status}
            >
                {({ getFieldValue }) => {
                    const status = getFieldValue(['personalHistory', 'smoking_status']);
                    return status === '吸烟' || status === '已戒烟' ? (
                        <Form.Item name={['personalHistory', 'smoking_details']} label="吸烟详情">
                            <Input placeholder="例如：20支/日 × 10年，戒烟2年" />
                        </Form.Item>
                    ) : null;
                }}
            </Form.Item>
          </div>

          <div style={{ background: '#fafafa', padding: '8px 16px', borderRadius: 4, marginBottom: 12 }}>
            <Form.Item name={['personalHistory', 'alcohol_status']} label="饮酒史">
                <Radio.Group>
                    <Radio value="从不">从不饮酒</Radio>
                    <Radio value="已戒酒">已戒酒</Radio>
                    <Radio value="饮酒">饮酒</Radio>
                </Radio.Group>
            </Form.Item>
            <Form.Item 
                noStyle 
                shouldUpdate={(prev, curr) => prev?.personalHistory?.alcohol_status !== curr?.personalHistory?.alcohol_status}
            >
                {({ getFieldValue }) => {
                    const status = getFieldValue(['personalHistory', 'alcohol_status']);
                    return status === '饮酒' || status === '已戒酒' ? (
                        <Form.Item name={['personalHistory', 'alcohol_details']} label="饮酒详情">
                            <Input placeholder="例如：白酒 2两/日 × 10年" />
                        </Form.Item>
                    ) : null;
                }}
            </Form.Item>
          </div>

          <Form.Item name={['personalHistory', 'substances']} label="其他嗜好">
              <Input placeholder="药物依赖、其他不良嗜好" />
          </Form.Item>
      </Card>
      
      <Card type="inner" title="3. 冶游史" size="small">
          <Form.Item name={['personalHistory', 'sexual_history']} label="冶游史">
              <TextArea placeholder="如有不洁性交史等，请记录" />
          </Form.Item>
      </Card>
    </div>
  );
};

export default PersonalHistorySection;
