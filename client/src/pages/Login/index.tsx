import React, { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Button, Card, Form, Input, Space, Typography, Tabs } from 'antd';
import { LockOutlined, UserOutlined, SafetyOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api, { unwrapData, getApiErrorMessage } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';

const { Title, Text } = Typography;

/**
 * 是否显示令牌登录选项
 * 开发环境显示，生产环境隐藏
 */
const SHOW_TOKEN_LOGIN = import.meta.env.DEV;

/**
 * 获取环境显示标签
 * 仅开发环境显示，生产环境不显示
 */
const getEnvLabel = () => {
  if (import.meta.env.DEV) return { text: '开发环境', color: '#52c41a' };
  return null; // 生产环境不显示标签
};

type LoginResult = { operatorId: number; role: 'admin' | 'doctor'; name?: string; token?: string };
type PasswordLoginValues = { username: string; password: string };
type TokenLoginValues = { token: string };

const PasswordLogin: React.FC<{ onSuccess: (data: LoginResult) => void }> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { message } = AntdApp.useApp();

  const onFinish = async (values: PasswordLoginValues) => {
    setLoading(true);
    try {
      const res = (await api.post('/auth/login', values)) as ApiResponse<LoginResult | { data: LoginResult }>;
      const payload = unwrapData<LoginResult>(res);
      if (!res?.success || !payload) throw new Error('登录响应无效');
      onSuccess(payload);
    } catch (err) {
      console.error('[Login] Password login failed', err);
      message.error(getApiErrorMessage(err, '登录失败，请检查用户名或密码'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form layout="vertical" onFinish={onFinish} size="large" style={{ marginTop: 20 }}>
      <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input prefix={<UserOutlined />} placeholder="用户名" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>登录</Button>
      </Form.Item>
    </Form>
  );
};

const TokenLogin: React.FC<{ onSuccess: (data: LoginResult) => void }> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { message } = AntdApp.useApp();

  const onFinish = async (values: TokenLoginValues) => {
    setLoading(true);
    try {
      const res = (await api.post('/auth/login', values)) as ApiResponse<LoginResult | { data: LoginResult }>;
      const payload = unwrapData<LoginResult>(res);
      if (!res?.success || !payload) throw new Error('登录响应无效');
      onSuccess(payload);
    } catch (err) {
      console.error('[Login] Token login failed', err);
      message.error(getApiErrorMessage(err, '登录失败，请检查令牌'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form layout="vertical" onFinish={onFinish} size="large" style={{ marginTop: 20 }}>
      <Form.Item name="token" rules={[{ required: true, message: '请输入登录令牌' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="请输入令牌 (开发环境: dev-admin)" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>登录</Button>
      </Form.Item>
    </Form>
  );
};

const Login: React.FC = () => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('password');

  const redirectTo = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const next = String(sp.get('redirect') || '/').trim();
    if (!next.startsWith('/')) return '/';
    if (next.startsWith('/login') || next.startsWith('/register')) return '/';
    return next;
  }, [location.search]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = (await api.get('/auth/me')) as ApiResponse<LoginResult | { data: LoginResult }>;
        const payload = unwrapData<LoginResult>(res);
        if (!alive) return;
        if (res?.success && payload) {
          navigate(redirectTo, { replace: true });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate, redirectTo]);

  const handleSuccess = (payload: LoginResult) => {
    console.log('[Login] 登录成功', { operatorId: payload.operatorId, role: payload.role });
    try {
      if (payload.token) {
        window.localStorage.setItem('OPERATOR_TOKEN', payload.token);
      }
      window.localStorage.setItem('OPERATOR_ROLE', payload.role);
      window.localStorage.setItem('OPERATOR_ID', String(payload.operatorId));
      if (payload.name) {
        window.localStorage.setItem('OPERATOR_NAME', payload.name);
      }
    } catch {
      // ignore
    }
    message.success('登录成功');
    navigate(redirectTo, { replace: true });
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
        <Space align="center" size={10} style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>
          <SafetyOutlined style={{ fontSize: 24, color: 'var(--msia-primary)' }} />
          <Title level={2} style={{ margin: 0 }}>用户登录</Title>
        </Space>
        {getEnvLabel() && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Text style={{ 
              color: getEnvLabel()?.color, 
              fontSize: 12, 
              padding: '2px 8px', 
              border: `1px solid ${getEnvLabel()?.color}`,
              borderRadius: 4,
              display: 'inline-block'
            }}>
              {getEnvLabel()?.text}
            </Text>
          </div>
        )}

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'password',
              label: '账号密码登录',
              children: <PasswordLogin onSuccess={handleSuccess} />,
            },
            ...(SHOW_TOKEN_LOGIN
              ? [
                  {
                    key: 'token',
                    label: (
                      <span>
                        令牌登录
                        <span style={{ 
                          marginLeft: 4, 
                          fontSize: 10, 
                          color: '#52c41a',
                          border: '1px solid #52c41a',
                          padding: '0 4px',
                          borderRadius: 2
                        }}>
                          开发
                        </span>
                      </span>
                    ),
                    children: <TokenLogin onSuccess={handleSuccess} />,
                  },
                ]
              : []),
          ]}
        />
        
        <div style={{ textAlign: 'center', marginTop: 10 }}>
            <Text type="secondary">还没有账号？</Text>
            <Link to="/register">立即注册</Link>
        </div>
      </Card>
    </div>
  );
};

export default Login;
