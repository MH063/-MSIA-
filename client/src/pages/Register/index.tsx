import React, { useState } from 'react';
import { App as AntdApp, Button, Card, Form, Input, Space, Typography, Select } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import api, { unwrapData, getApiErrorMessage } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';

const { Title, Text } = Typography;

type RegisterResult = {
  operatorId: number;
  role: 'admin' | 'doctor';
  name: string;
  token?: string;
};

type RegisterValues = {
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'doctor';
};

const Register: React.FC = () => {
  const [form] = Form.useForm();
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: RegisterValues) => {
    setLoading(true);
    try {
      console.log('[Register] 尝试注册', values);
      const res = (await api.post('/auth/register', values)) as ApiResponse<RegisterResult | { data: RegisterResult }>;
      const payload = unwrapData<RegisterResult>(res);
      
      if (!res?.success || !payload) {
        throw new Error('注册响应无效');
      }

      try {
        window.localStorage.removeItem('OPERATOR_TOKEN');
        window.localStorage.removeItem('OPERATOR_ROLE');
        window.localStorage.removeItem('OPERATOR_ID');
        window.localStorage.removeItem('OPERATOR_NAME');
      } catch {
        // ignore
      }
      
      message.success('注册成功，即将跳转');
      navigate('/');
    } catch (err) {
      console.error('[Register] 注册失败', err);
      message.error(getApiErrorMessage(err, '注册失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="msia-page" 
      style={{ 
        display: 'grid', 
        placeItems: 'center', 
        minHeight: '100%', 
        height: '100%' 
      }}
    >
      <Card className="msia-card" style={{ width: 'min(520px, 92vw)' }} styles={{ body: { padding: 40 } }}>
        <Space align="center" size={10} style={{ width: '100%', justifyContent: 'center', marginBottom: 30 }}>
          <SafetyOutlined style={{ fontSize: 24, color: 'var(--msia-primary)' }} />
          <Title level={2} style={{ margin: 0 }}>用户注册</Title>
        </Space>

        <Form form={form} layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少8个字符' },
              { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/u, message: '密码需包含字母和数字' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          
          <Form.Item
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
             <Input prefix={<UserOutlined />} placeholder="真实姓名" />
          </Form.Item>

          <Form.Item
            name="role"
            initialValue="doctor"
          >
            <Select
               prefix={<TeamOutlined />}
               options={[
                 { label: '医生', value: 'doctor' },
                 { label: '管理员', value: 'admin' },
               ]}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              立即注册
            </Button>
          </Form.Item>
          
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">已有账号？</Text>
            <Link to="/login">去登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Register;
