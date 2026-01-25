import React from 'react';
import { Form, Input, Row, Col, Typography, Select, DatePicker } from 'antd';

const { Title } = Typography;

const GeneralSection: React.FC = () => {
  return (
    <div>
      <Title level={5}>一般项目 (General Information)</Title>
      
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="gender" label="性别" rules={[{ required: true }]}>
             <Select>
                 <Select.Option value="男">男</Select.Option>
                 <Select.Option value="女">女</Select.Option>
             </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
           <Form.Item name="age" label="年龄">
             <Input suffix="岁" />
           </Form.Item>
        </Col>
        <Col span={8}>
           <Form.Item name="birthDate" label="出生日期">
              <DatePicker style={{ width: '100%' }} />
           </Form.Item>
        </Col>
        <Col span={8}>
            <Form.Item name="placeOfBirth" label="出生地">
                <Input />
            </Form.Item>
        </Col>
        <Col span={8}>
            <Form.Item name="ethnicity" label="民族">
                <Input />
            </Form.Item>
        </Col>
        <Col span={8}>
            <Form.Item name="nativePlace" label="籍贯">
                <Input />
            </Form.Item>
        </Col>
        <Col span={12}>
             <Form.Item name="occupation" label="职业">
                 <Input />
             </Form.Item>
        </Col>
        <Col span={12}>
             <Form.Item name="employer" label="工作单位">
                 <Input />
             </Form.Item>
        </Col>
        <Col span={12}>
             <Form.Item name="phone" label="联系电话" rules={[
                 { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
             ]}>
                 <Input />
             </Form.Item>
        </Col>
        <Col span={24}>
             <Form.Item name="address" label="联系地址">
                 <Input />
             </Form.Item>
        </Col>
      </Row>

      <Title level={5} style={{ marginTop: 24 }}>供史信息</Title>
      <Row gutter={16}>
          <Col span={8}>
              <Form.Item name="historian" label="病史陈述者" initialValue="本人">
                  <Select>
                      <Select.Option value="本人">本人</Select.Option>
                      <Select.Option value="家属">家属</Select.Option>
                      <Select.Option value="其他">其他</Select.Option>
                  </Select>
              </Form.Item>
          </Col>
          <Col span={8}>
              <Form.Item name="reliability" label="可靠程度" initialValue="可靠">
                  <Select>
                      <Select.Option value="可靠">可靠</Select.Option>
                      <Select.Option value="基本可靠">基本可靠</Select.Option>
                      <Select.Option value="不可靠">不可靠</Select.Option>
                  </Select>
              </Form.Item>
          </Col>
      </Row>
    </div>
  );
};

export default GeneralSection;
