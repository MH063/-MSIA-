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
          <Col span={6}>
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="输入患者姓名" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="gender" label="性别" rules={[{ required: true, message: '请选择性别' }]}>
               <Select placeholder="选择性别">
                   <Select.Option value="男">男</Select.Option>
                   <Select.Option value="女">女</Select.Option>
                   <Select.Option value="其他">其他</Select.Option>
               </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
             <Form.Item name="age" label="年龄" help="可自动计算或手动修正">
               <Input suffix="岁" style={{ background: '#fff' }} placeholder="年龄" />
             </Form.Item>
          </Col>
          <Col span={6}>
              <Form.Item name="ethnicity" label="民族" initialValue="汉族">
                <Input placeholder="如：汉族" />
              </Form.Item>
          </Col>
          <Col span={6}>
              <Form.Item name={['maritalHistory', 'status']} label="婚姻状况">
                  <Select placeholder="选择婚姻状况">
                      <Select.Option value="未婚">未婚</Select.Option>
                      <Select.Option value="已婚">已婚</Select.Option>
                      <Select.Option value="离异">离异</Select.Option>
                      <Select.Option value="丧偶">丧偶</Select.Option>
                  </Select>
              </Form.Item>
          </Col>
          <Col span={6}>
              <Form.Item name="nativePlace" label="籍贯">
                  <Input placeholder="省/市" />
              </Form.Item>
          </Col>
          <Col span={6}>
              <Form.Item name="placeOfBirth" label="出生地">
                  <Input placeholder="省/市/县" />
              </Form.Item>
          </Col>
          <Col span={6}>
               <Form.Item name="occupation" label="职业">
                  <Input placeholder="职业" />
               </Form.Item>
          </Col>
          <Col span={6}>
             <Form.Item name="birthDate" label="出生日期">
                <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
             </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* 2. 记录信息 */}
      <Card type="inner" title="【记录信息】" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={8}>
              <Form.Item name={['generalInfo', 'admissionTime']} label="入院时间">
                  <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} placeholder="年-月-日 时:分" />
              </Form.Item>
          </Col>
          <Col span={8}>
              <Form.Item name={['generalInfo', 'recordTime']} label="记录时间" initialValue={dayjs()}>
                  <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} placeholder="年-月-日 时:分" />
              </Form.Item>
          </Col>
          <Col span={8}>
             {/* 占位 */}
          </Col>
          <Col span={8}>
              <Form.Item name="historian" label="病史陈述者" initialValue="本人" tooltip="非患者本人时需注明与患者关系及可靠程度">
                   <Select>
                        <Select.Option value="本人">本人</Select.Option>
                        <Select.Option value="家属">家属</Select.Option>
                        <Select.Option value="同事/朋友">同事/朋友</Select.Option>
                        <Select.Option value="其他">其他</Select.Option>
                    </Select>
              </Form.Item>
          </Col>
          <Col span={8}>
            {historian !== '本人' && (
              <Form.Item name="historianRelationship" label="与患者关系">
                   <Input placeholder="如：父子、夫妻" />
              </Form.Item>
            )}
          </Col>
          <Col span={8}>
              <Form.Item name="reliability" label="可靠程度" initialValue="可靠">
                  <Select placeholder="选择可靠程度">
                      <Select.Option value="可靠">可靠</Select.Option>
                      <Select.Option value="基本可靠">基本可靠</Select.Option>
                      <Select.Option value="供参考">供参考</Select.Option>
                      <Select.Option value="不可靠">不可靠</Select.Option>
                  </Select>
              </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* 3. 联系信息 */}
      <Card type="inner" title="【联系信息】" size="small">
        <Row gutter={24}>
          <Col span={8}>
               <Form.Item name="phone" label="联系电话" rules={[
                   { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
               ]}>
                   <Input placeholder="11位手机号" />
               </Form.Item>
          </Col>
          <Col span={8}>
               <Form.Item name="employer" label="工作单位">
                   <Input placeholder="输入工作单位名称" />
               </Form.Item>
          </Col>
          <Col span={8}>
               <Form.Item name="address" label="联系地址">
                   <Input placeholder="输入详细居住地址" />
               </Form.Item>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default GeneralSection;
