import React, { useState } from 'react';
import { Button, Form, Input, Select, DatePicker, Card, message, Row, Col, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { UserOutlined, HomeOutlined, SettingOutlined, AuditOutlined } from '@ant-design/icons';
import api, { unwrapData } from '../../utils/api';
import type { Dayjs } from 'dayjs';

const { Title } = Typography;

const NewInterview: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const historian = Form.useWatch('historian', form);

  /**
   * InterviewFormValues
   * 描述“开始问诊”表单的字段类型，包含患者基本信息与病史陈述者信息
   */
  interface InterviewFormValues {
    name: string;
    gender: string;
    birthDate?: Dayjs;
    nativePlace?: string;
    placeOfBirth?: string;
    ethnicity?: string;
    address?: string;
    occupation?: string;
    employer?: string;
    phone?: string;
    historian: string;
    reliability: string;
    historianRelationship?: string;
  }

  /**
   * onFinish
   * 处理表单提交：先创建患者，再创建会话；成功后导航到问诊页面
   */
  const onFinish = async (values: InterviewFormValues) => {
    setLoading(true);
    try {
      console.log('[Interview] 提交表单数据', values);
      // 1. 创建患者
      const patientRes = await api.post('/patients', {
        name: values.name,
        gender: values.gender,
        birthDate: values.birthDate ? values.birthDate.format('YYYY-MM-DD') : undefined,
        nativePlace: values.nativePlace,
        placeOfBirth: values.placeOfBirth,
        ethnicity: values.ethnicity,
        address: values.address,
        occupation: values.occupation,
        employer: values.employer,
        contactInfo: { phone: values.phone },
      }) as unknown as import('../../utils/api').ApiResponse<{ id: string }>;

      const patientData = unwrapData<{ id: string }>(patientRes);
      if (patientData) {
        const patientId = patientData.id;
        
        // 2. 创建会话
        try {
          const sessionRes = await api.post('/sessions', {
            patientId: patientId,
            historian: values.historian,
            reliability: values.reliability,
            historianRelationship: values.historianRelationship
          }) as unknown as import('../../utils/api').ApiResponse<{ id: string }>;

          const sessionData = unwrapData<{ id: string }>(sessionRes);
          if (sessionData) {
            console.log('[Interview] 创建会话成功', sessionData);
            message.success('会话创建成功');
            navigate(`/interview/${sessionData.id}`);
            return;
          } else {
            throw new Error('会话创建失败');
          }
        } catch (err) {
          console.error('[Interview] 创建会话失败:', err);
          try {
            await api.delete(`/patients/${patientId}`) as unknown as import('../../utils/api').ApiResponse;
            message.error('会话创建失败，已回滚患者记录');
          } catch (rollbackErr) {
            console.error('[Interview] 患者回滚失败:', rollbackErr);
            message.error('会话创建失败，患者回滚失败，请手动处理');
          }
        }
      }
    } catch (error) {
      console.error('[Interview] 创建会话失败:', error);
      message.error('创建会话失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>开始新问诊</Title>
        <Typography.Text type="secondary">请录入患者基本信息以建立档案，随后将进入智能问诊环节。</Typography.Text>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} size="middle">
        <Row gutter={24}>
          {/* 左侧主要信息区 */}
          <Col xs={24} lg={16}>
            <Card 
              title={<Space><UserOutlined /><span>患者基本信息</span></Space>} 
              style={{ marginBottom: 24 }}
              variant="borderless"
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
                    <Input placeholder="请输入患者姓名" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="gender" label="性别" rules={[{ required: true }]}>
                    <Select>
                      <Select.Option value="男">男</Select.Option>
                      <Select.Option value="女">女</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="birthDate" label="出生日期" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="ethnicity" label="民族">
                    <Input placeholder="如：汉族" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="nativePlace" label="籍贯">
                    <Input placeholder="省/市" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="placeOfBirth" label="出生地">
                    <Input placeholder="省/市" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card 
              title={<Space><HomeOutlined /><span>社会背景信息</span></Space>} 
              style={{ marginBottom: 24 }}
              variant="borderless"
            >
              <Row gutter={24}>
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
                <Col span={12}>
                  <Form.Item name="phone" label="联系电话">
                    <Input placeholder="请输入联系电话" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="address" label="通信地址">
                    <Input placeholder="请输入详细地址" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* 右侧配置区 */}
          <Col xs={24} lg={8}>
            <Card 
              title={<Space><SettingOutlined /><span>问诊配置</span></Space>} 
              style={{ marginBottom: 24 }}
              variant="borderless"
              extra={<Button type="link" onClick={() => form.resetFields()}>重置</Button>}
            >
              <Form.Item name="historian" label="病史陈述者" initialValue="本人">
                <Select>
                  <Select.Option value="本人">本人</Select.Option>
                  <Select.Option value="家属">家属</Select.Option>
                  <Select.Option value="其他">其他</Select.Option>
                </Select>
              </Form.Item>

              {historian !== '本人' && (
                <Form.Item name="historianRelationship" label="与病人关系" rules={[{ required: true, message: '请填写与病人关系' }]}>
                  <Input placeholder="如：父子、夫妻等" />
                </Form.Item>
              )}

              <Form.Item name="reliability" label="可靠程度" initialValue="可靠">
                <Select>
                  <Select.Option value="可靠">可靠</Select.Option>
                  <Select.Option value="基本可靠">基本可靠</Select.Option>
                  <Select.Option value="供参考">供参考</Select.Option>
                </Select>
              </Form.Item>

              <div style={{ marginTop: 24 }}>
                <Button type="primary" htmlType="submit" loading={loading} block size="large" icon={<AuditOutlined />}>
                  开始问诊
                </Button>
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                   <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                     点击开始即表示确认上述信息无误
                   </Typography.Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default NewInterview;
