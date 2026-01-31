import React from 'react';
import { Form, Input, InputNumber, Card, Row, Col, DatePicker, Radio, Select } from 'antd';

const { Option } = Select;

const MenstrualHistorySection: React.FC = () => {
  const form = Form.useFormInstance();
  const gender = Form.useWatch('gender', form);
  const isMenopause = Form.useWatch(['menstrualHistory', 'isMenopause'], form);

  // 仅女性显示
  if (gender !== '女') {
    return null;
  }

  return (
    <div className="section-container">
      <Card type="inner" title="月经史 (Menstrual History)" size="small">
        <Row gutter={24}>
          <Col span={6}>
            <Form.Item name={['menstrualHistory', 'age']} label="初潮年龄(岁)">
              <InputNumber style={{ width: '100%' }} placeholder="例如: 13" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name={['menstrualHistory', 'duration']} label="经期(天)">
              <InputNumber style={{ width: '100%' }} placeholder="例如: 5" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name={['menstrualHistory', 'cycle']} label="周期(天)">
              <InputNumber style={{ width: '100%' }} placeholder="例如: 28" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name={['menstrualHistory', 'lmp_date']} label="末次月经(LMP)">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={8}>
            <Form.Item name={['menstrualHistory', 'flow']} label="经量">
              <Select placeholder="请选择">
                <Option value="多">多</Option>
                <Option value="中">中</Option>
                <Option value="少">少</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={['menstrualHistory', 'pain']} label="痛经">
               <Input placeholder="例如: 无 / 轻度 / 剧烈" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="绝经">
              <Form.Item
                name={['menstrualHistory', 'isMenopause']}
                initialValue={false}
                noStyle
              >
                <Radio.Group
                  onChange={e => {
                    const next = e.target.value as boolean;
                    if (!next) {
                      form.setFieldValue(['menstrualHistory', 'menopause_age'], undefined);
                    }
                  }}
                >
                  <Radio value={false}>未绝经</Radio>
                  <Radio value={true}>已绝经</Radio>
                </Radio.Group>
              </Form.Item>
            </Form.Item>
          </Col>
        </Row>

        {isMenopause && (
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name={['menstrualHistory', 'menopause_age']} label="绝经年龄(岁)">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Card>
    </div>
  );
};

export default MenstrualHistorySection;
