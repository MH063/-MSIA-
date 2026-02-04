import React, { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Button, Card, Form, Input, Space, Typography } from 'antd';
import { LockOutlined, LoginOutlined, SafetyOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';

const { Title, Paragraph, Text } = Typography;

type LoginResult = { operatorId: number; role: 'admin' | 'doctor' };

const Login: React.FC = () => {
  const [form] = Form.useForm();
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const redirectTo = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const next = String(sp.get('redirect') || '/').trim();
    if (!next.startsWith('/')) return '/';
    if (next.startsWith('/login')) return '/';
    return next;
  }, [location.search]);

  useEffect(() => {
    try {
      const token = String(window.localStorage.getItem('OPERATOR_TOKEN') || '').trim();
      if (token) {
        navigate(redirectTo, { replace: true });
      }
    } catch {
      // ignore
    }
  }, [navigate, redirectTo]);

  const onFinish = async (values: { token: string }) => {
    const token = String(values?.token || '').trim();
    if (!token) {
      message.warning('请输入登录令牌');
      return;
    }
    setLoading(true);
    try {
      console.log('[Login] 尝试登录');
      const res = (await api.post('/auth/login', { token })) as ApiResponse<LoginResult | { data: LoginResult }>;
      const payload = unwrapData<LoginResult>(res);
      if (!res?.success || !payload) {
        message.error('登录失败');
        return;
      }
      window.localStorage.setItem('OPERATOR_TOKEN', token);
      window.localStorage.setItem('OPERATOR_ROLE', payload.role);
      window.localStorage.setItem('OPERATOR_ID', String(payload.operatorId));
      console.log('[Login] 登录成功', payload);
      message.success('登录成功');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error('[Login] 登录失败', err);
      message.error('登录失败，请检查令牌是否正确');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="msia-page" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <Card className="msia-card" style={{ width: 'min(520px, 92vw)' }} styles={{ body: { padding: 20 } }}>
        <Space align="center" size={10}>
          <SafetyOutlined style={{ fontSize: 18, color: 'var(--msia-primary)' }} />
          <Title level={3} style={{ margin: 0 }}>用户认证</Title>
        </Space>
        <Paragraph style={{ marginTop: 10, marginBottom: 0 }}>
          请输入系统发放的登录令牌。开发环境默认可用<Text code>dev-admin</Text>（未配置令牌时）。
        </Paragraph>

        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={onFinish}>
          <Form.Item
            name="token"
            label="登录令牌"
            rules={[{ required: true, message: '请输入登录令牌' }]}
          >
            <Input.Password
              autoFocus
              prefix={<LockOutlined />}
              placeholder="请输入令牌"
              autoComplete="current-password"
              onPressEnter={() => form.submit()}
            />
          </Form.Item>

          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text type="secondary">登录后会自动保存令牌到本地</Text>
            <Button type="primary" icon={<LoginOutlined />} htmlType="submit" loading={loading}>
              登录
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
