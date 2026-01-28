import React, { useEffect } from 'react';
import { Form, Input, Row, Col, Typography, Select, DatePicker, Card } from 'antd';
import dayjs from 'dayjs';

const { Title } = Typography;

const GeneralSection: React.FC = () => {
  const form = Form.useFormInstance();
  const birthDate = Form.useWatch('birthDate', form);
  const historian = Form.useWatch('historian', form);

  /**
   * 自动计算年龄，避免重复写入导致受控组件循环更新
   */
  useEffect(() => {
    if (birthDate) {
      const birth = dayjs(birthDate);
      const now = dayjs();
      if (birth.isValid()) {
        const age = now.diff(birth, 'year');
        const prev = form.getFieldValue('age');
        if (prev !== age) {
          form.setFieldValue('age', age);
        }
      }
    }
  }, [birthDate, form]);

  /**
   * 当陈述者为本人时，清空关系字段（仅在值不同时执行）
   */
  useEffect(() => {
      if (historian === '本人') {
          const prev = form.getFieldValue('historianRelationship');
          if (prev !== undefined) {
            form.setFieldValue('historianRelationship', undefined);
          }
      }
  }, [historian, form]);

  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>一般项目 (General Information)</Title>
      
      {/* 1. 基本信息 */}
      <Card type="inner" title="【基本信息】" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="输入患者姓名" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="gender" label="性别" rules={[{ required: true, message: '请选择性别' }]}>
               <Select placeholder="选择性别">
                   <Select.Option value="男">男</Select.Option>
                   <Select.Option value="女">女</Select.Option>
               </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
             <Form.Item name="age" label="年龄" help="根据出生日期自动计算">
               <Input suffix="岁" readOnly style={{ background: '#f5f5f5' }} />
             </Form.Item>
          </Col>
          <Col span={8}>
             <Form.Item name="birthDate" label="出生日期" rules={[{ required: true, message: '请选择出生日期' }]}>
                <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
             </Form.Item>
          </Col>
          <Col span={8}>
              <Form.Item name="placeOfBirth" label="出生地">
                  <Input placeholder="省/市" />
              </Form.Item>
          </Col>
          <Col span={8}>
              <Form.Item name="ethnicity" label="民族" initialValue="汉族">
                  <Select showSearch>
                      <Select.Option value="汉族">汉族</Select.Option>
                      <Select.Option value="回族">回族</Select.Option>
                      <Select.Option value="满族">满族</Select.Option>
                      <Select.Option value="蒙古族">蒙古族</Select.Option>
                      <Select.Option value="维吾尔族">维吾尔族</Select.Option>
                      <Select.Option value="其他">其他</Select.Option>
                  </Select>
              </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* 2. 联系信息 */}
      <Card type="inner" title="【联系信息】" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={8}>
              <Form.Item name="nativePlace" label="籍贯">
                  <Input placeholder="省/市" />
              </Form.Item>
          </Col>
          <Col span={8}>
               <Form.Item name="occupation" label="职业">
                   <Input placeholder="如：工人、教师" />
               </Form.Item>
          </Col>
          <Col span={8}>
               <Form.Item name="phone" label="联系电话" rules={[
                   { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
               ]}>
                   <Input placeholder="11位手机号" />
               </Form.Item>
          </Col>
          <Col span={12}>
               <Form.Item name="employer" label="工作单位">
                   <Input placeholder="输入工作单位名称" />
               </Form.Item>
          </Col>
          <Col span={12}>
               <Form.Item name="address" label="联系地址">
                   <Input placeholder="输入详细居住地址" />
               </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* 3. 供史信息 */}
      <Card type="inner" title="【供史信息】" size="small">
        <Row gutter={24}>
            <Col span={8}>
                <Form.Item name="historian" label="病史陈述者" initialValue="本人">
                    <Select>
                        <Select.Option value="本人">本人</Select.Option>
                        <Select.Option value="家属">家属</Select.Option>
                        <Select.Option value="同事/朋友">同事/朋友</Select.Option>
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
            {historian !== '本人' && (
                <Col span={8}>
                    <Form.Item name="historianRelationship" label="与患者关系" rules={[{ required: true, message: '请输入关系' }]}>
                        <Input placeholder="如：父子、夫妻" />
                    </Form.Item>
                </Col>
            )}
        </Row>
      </Card>
    </div>
  );
};

export default GeneralSection;
