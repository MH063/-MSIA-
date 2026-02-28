import React, { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Button, Form, Input, Typography, Tabs, theme } from 'antd';
import { LockOutlined, UserOutlined, SafetyOutlined, MedicineBoxFilled, MailOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api, { unwrapData, getApiErrorMessage } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import './login.css';
import Captcha from '../../components/Captcha';
import logger from '../../utils/logger';

const { Title } = Typography;

/**
 * 是否显示令牌登录选项
 * 开发环境显示，生产环境隐藏
 */
const SHOW_TOKEN_LOGIN = import.meta.env.DEV;

/**
 * 获取环境显示标签
 */
const getEnvLabel = () => {
  if (import.meta.env.DEV) return { text: '开发环境', color: '#52c41a' };
  return null;
};

type LoginResult = { operatorId: number; role: 'admin' | 'doctor'; name?: string };
type PasswordLoginValues = { username: string; password: string; captcha: string; captchaId: string };
type TokenLoginValues = { token: string; captcha: string; captchaId: string };

function getCaptchaFromError(e: unknown): { id: string; svg: string } | null {
  const asRecord = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  const rec = asRecord(e);
  const response = rec ? asRecord(rec.response) : null;
  const data = response ? asRecord(response.data) : null;
  const inner = data ? asRecord(data.data) : null;
  const cap = inner ? asRecord(inner.captcha) : null;
  const id = cap ? cap.id : undefined;
  const svg = cap ? cap.svg : undefined;
  if (typeof id === 'string' && id && typeof svg === 'string' && svg) {
    return { id, svg };
  }
  return null;
}

const isValidUuid = (s: string | undefined) => {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
};

const isValidCaptchaCode = (s: string | undefined) => {
  if (!s) return false;
  return /^[A-Za-z0-9]{4}$/.test(s);
};

const PasswordLogin: React.FC<{ onSuccess: (data: LoginResult) => void }> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [serverCaptcha, setServerCaptcha] = useState<{ id: string; svg: string } | null>(null);
  const { message } = AntdApp.useApp();
  const { token } = theme.useToken();

  const [form] = Form.useForm<PasswordLoginValues & { captchaId: string }>();
  const triggerCaptchaRefresh = () => {
    setCaptchaVerified(false);
    setServerCaptcha(null);
    form.setFieldsValue({ captcha: '', captchaId: '' });
    setCaptchaRefreshKey((prev) => prev + 1);
  };

  const onFinish = async (values: PasswordLoginValues) => {
    logger.info('[Login] 提交登录表单', { values });
    try {
      const idOk = isValidUuid(values.captchaId);
      const codeOk = isValidCaptchaCode(values.captcha);
      logger.info('[Login] 验证码校验', { captchaId: values.captchaId, captcha: values.captcha, idOk, codeOk });
      if (!idOk || !codeOk) {
        message.error('验证码ID或验证码格式无效，请点击图片刷新后重试');
        triggerCaptchaRefresh();
        return;
      }
      if (!captchaVerified) {
        message.error('请输入正确的验证码');
        triggerCaptchaRefresh();
        return;
      }
      setLoading(true);
      const res = (await api.post('/auth/login', values)) as ApiResponse<LoginResult | { data: LoginResult }>;
      const payload = unwrapData<LoginResult>(res);
      if (!res?.success || !payload) throw new Error('登录响应无效');
      // 认证信息通过 Cookie 传递，无需存储到 localStorage
      onSuccess(payload);
    } catch (err) {
      logger.error('[Login] Password login failed', err);
      const msg = getApiErrorMessage(err, '登录失败，请检查用户名或密码');
      const newCaptcha = getCaptchaFromError(err);
      if (newCaptcha && newCaptcha.id && newCaptcha.svg) {
        setServerCaptcha({ id: newCaptcha.id, svg: newCaptcha.svg });
        setCaptchaVerified(false);
        form.setFieldsValue({ captcha: '', captchaId: String(newCaptcha.id) });
      } else if (msg.includes('验证码')) {
        triggerCaptchaRefresh();
      }
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form layout="vertical" form={form} onFinish={onFinish} size="large" className="login-form">
      <Form.Item 
        name="username" 
        rules={[{ required: true, message: '请输入用户名' }]}
        className="login-form-item"
      >
        <Input 
          prefix={<UserOutlined className="login-input-icon" style={{ color: token.colorTextPlaceholder }} />} 
          placeholder="请输入用户名" 
          className="login-input"
          autoComplete="username"
          style={{ background: token.colorBgContainer, color: token.colorText }}
        />
      </Form.Item>
      <Form.Item 
        name="password" 
        rules={[{ required: true, message: '请输入密码' }]}
        className="login-form-item"
      >
        <Input.Password 
          prefix={<LockOutlined className="login-input-icon" style={{ color: token.colorTextPlaceholder }} />} 
          placeholder="请输入密码" 
          className="login-input"
          autoComplete="current-password"
          style={{ background: token.colorBgContainer, color: token.colorText }}
        />
      </Form.Item>
      <Form.Item
        name="captcha"
        rules={[{ required: true, message: '请输入验证码' }]}
        className="login-form-item"
      >
        <Captcha
          key={`captcha-${captchaRefreshKey}`}
          externalCaptcha={serverCaptcha ?? undefined}
          onChange={(v) => form.setFieldsValue({ captcha: v })}
          onVerify={setCaptchaVerified}
          onIdChange={(id) => form.setFieldsValue({ captchaId: id })}
        />
      </Form.Item>
      <Form.Item name="captchaId" initialValue="" hidden>
        <Input type="hidden" />
      </Form.Item>
      <Form.Item className="login-form-item">
        <Button 
          type="primary" 
          htmlType="submit" 
          loading={loading} 
          block
          className="login-button"
          disabled={!captchaVerified}
        >
          登 录
        </Button>
      </Form.Item>
      <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 8 }}>
        <Link to="/forgot-password" style={{ color: token.colorPrimary, fontSize: 13 }}>
          忘记密码？
        </Link>
      </div>
    </Form>
  );
};

const TokenLogin: React.FC<{ onSuccess: (data: LoginResult) => void }> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [serverCaptcha, setServerCaptcha] = useState<{ id: string; svg: string } | null>(null);
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<TokenLoginValues & { captchaId: string }>();
  
  const triggerCaptchaRefresh = () => {
    setCaptchaVerified(false);
    setServerCaptcha(null);
    form.setFieldsValue({ captcha: '', captchaId: '' });
    setCaptchaRefreshKey((prev) => prev + 1);
  };

  const onFinish = async (values: TokenLoginValues) => {
    try {
      const idOk = isValidUuid(values.captchaId);
      const codeOk = isValidCaptchaCode(values.captcha);
      if (!idOk || !codeOk) {
        message.error('验证码ID或验证码格式无效，请点击图片刷新后重试');
        triggerCaptchaRefresh();
        return;
      }
      if (!captchaVerified) {
        message.error('请输入正确的验证码');
        triggerCaptchaRefresh();
        return;
      }
      setLoading(true);
      const res = (await api.post('/auth/login', values)) as ApiResponse<LoginResult | { data: LoginResult }>;
      const payload = unwrapData<LoginResult>(res);
      if (!res?.success || !payload) throw new Error('登录响应无效');
      // 认证信息通过 Cookie 传递，无需存储到 localStorage
      onSuccess(payload);
    } catch (err) {
      logger.error('[Login] Token login failed', err);
      const msg = getApiErrorMessage(err, '登录失败，请检查令牌');
      const newCaptcha = getCaptchaFromError(err);
      if (newCaptcha && newCaptcha.id && newCaptcha.svg) {
        setServerCaptcha({ id: newCaptcha.id, svg: newCaptcha.svg });
        setCaptchaVerified(false);
        form.setFieldsValue({ captcha: '', captchaId: String(newCaptcha.id) });
      } else if (msg.includes('验证码')) {
        triggerCaptchaRefresh();
      }
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form layout="vertical" form={form} onFinish={onFinish} size="large" className="login-form">
      <Form.Item 
        name="token" 
        rules={[{ required: true, message: '请输入登录令牌' }]}
        className="login-form-item"
      >
        <Input.Password 
          prefix={<LockOutlined className="login-input-icon" />} 
          placeholder="请输入令牌 (开发环境: dev-admin)" 
          className="login-input"
        />
      </Form.Item>
      <Form.Item
        name="captcha"
        rules={[{ required: true, message: '请输入验证码' }]}
        className="login-form-item"
      >
        <Captcha
          key={`captcha-${captchaRefreshKey}`}
          externalCaptcha={serverCaptcha ?? undefined}
          onChange={(v) => form.setFieldsValue({ captcha: v })}
          onVerify={setCaptchaVerified}
          onIdChange={(id) => form.setFieldsValue({ captchaId: id })}
        />
      </Form.Item>
      <Form.Item name="captchaId" initialValue="" hidden>
        <Input type="hidden" />
      </Form.Item>
      <Form.Item className="login-form-item">
        <Button 
          type="primary" 
          htmlType="submit" 
          loading={loading} 
          block
          className="login-button"
          disabled={!captchaVerified}
        >
          登 录
        </Button>
      </Form.Item>
    </Form>
  );
};

type EmailLoginValues = { email: string; password: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EmailLogin: React.FC<{ onSuccess: (data: LoginResult) => void }> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailValid, setEmailValid] = useState(false);
  const { message } = AntdApp.useApp();
  const { token } = theme.useToken();
  const [form] = Form.useForm<EmailLoginValues>();

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    const isValid = EMAIL_REGEX.test(value.trim());
    setEmailValid(isValid);
  };

  const isFormValid = emailValid && email.trim().length > 0;

  const onFinish = async (values: EmailLoginValues) => {
    if (!isFormValid) {
      message.warning('请输入有效的邮箱地址');
      return;
    }
    logger.info('[Login] 提交邮箱登录表单', { email: values.email });
    try {
      setLoading(true);
      const res = (await api.post('/auth/email/login', values)) as ApiResponse<LoginResult | { data: LoginResult }>;
      const payload = unwrapData<LoginResult>(res);
      if (!res?.success || !payload) throw new Error('登录响应无效');
      logger.info('[Login] 邮箱登录成功', { operatorId: payload.operatorId });
      await new Promise(resolve => setTimeout(resolve, 100));
      onSuccess(payload);
    } catch (err) {
      logger.error('[Login] Email login failed', err);
      const msg = getApiErrorMessage(err, '登录失败，请检查邮箱或密码');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form layout="vertical" form={form} onFinish={onFinish} size="large" className="login-form">
      <Form.Item 
        name="email" 
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '邮箱格式无效' },
        ]}
        className="login-form-item"
      >
        <Input 
          prefix={<MailOutlined className="login-input-icon" style={{ color: token.colorTextPlaceholder }} />} 
          placeholder="请输入邮箱地址" 
          className="login-input"
          autoComplete="email"
          style={{ background: token.colorBgContainer, color: token.colorText }}
          onChange={handleEmailChange}
          value={email}
        />
      </Form.Item>
      <Form.Item 
        name="password" 
        rules={[{ required: true, message: '请输入密码' }]}
        className="login-form-item"
      >
        <Input.Password 
          prefix={<LockOutlined className="login-input-icon" style={{ color: token.colorTextPlaceholder }} />} 
          placeholder="请输入密码" 
          className="login-input"
          autoComplete="current-password"
          style={{ background: token.colorBgContainer, color: token.colorText }}
        />
      </Form.Item>
      <Form.Item className="login-form-item">
        <Button 
          type="primary" 
          htmlType="submit" 
          loading={loading} 
          block
          className="login-button"
          disabled={!isFormValid}
        >
          登 录
        </Button>
      </Form.Item>
      <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 8 }}>
        <Link to="/forgot-password" style={{ color: token.colorPrimary, fontSize: 13 }}>
          忘记密码？
        </Link>
      </div>
    </Form>
  );
};

const Login: React.FC = () => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('password');
  const envTag = getEnvLabel();

  const redirectTo = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const next = String(sp.get('redirect') || '/home').trim();
    if (!next.startsWith('/')) return '/';
    if (next.startsWith('/login') || next.startsWith('/register')) return '/';
    return next;
  }, [location.search]);

  const shouldAutoRedirect = false;

  useEffect(() => {
    if (!shouldAutoRedirect) {
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = (await api.get('/auth/me', { _skipAuthRefresh: true })) as ApiResponse<LoginResult | { data: LoginResult }>;
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
  }, [location.search, navigate, redirectTo, shouldAutoRedirect]);

  const handleSuccess = async () => {
    message.success('登录成功');
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      const res = (await api.get('/auth/me', { _skipAuthRefresh: true })) as ApiResponse<LoginResult | { data: LoginResult }>;
      const payload = unwrapData<LoginResult>(res);
      logger.info('[Login] 登录后验证认证状态', { success: res?.success, operatorId: payload?.operatorId });
    } catch (err) {
      logger.warn('[Login] 登录后验证认证状态失败', err);
    }
    
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="login-page">
      <style>{`
        .login-page {
          background: var(--msia-bg) !important;
        }
        .login-bg-blob {
          opacity: var(--is-dark, 0.5) !important;
        }
        [data-theme="dark"] .login-bg-blob {
          --is-dark: 0.35;
        }
        .login-card {
          background: var(--msia-card) !important;
          border: 1px solid var(--msia-border) !important;
        }
        .login-input {
          background: var(--msia-bg) !important;
          border-color: var(--msia-border) !important;
          color: var(--msia-text) !important;
        }
        .login-input:hover, .login-input:focus {
          border-color: var(--msia-primary) !important;
        }
        .login-input-icon {
          color: var(--msia-text-tertiary) !important;
        }
        .login-title {
          color: var(--msia-text-primary) !important;
        }
        .login-subtitle {
          color: var(--msia-text-secondary) !important;
        }
      `}</style>
      
      {/* 动态背景 */}
      <div className="login-bg-decoration">
        <div className="login-bg-blob login-bg-blob-1" />
        <div className="login-bg-blob login-bg-blob-2" />
      </div>

      {envTag && (
        <div className="env-tag" style={{ background: '#f6ffed', border: '1px solid #b7eb8f', color: envTag.color }}>
          {envTag.text}
        </div>
      )}

      {/* 登录卡片 */}
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <MedicineBoxFilled />
          </div>
          <Title level={3} className="login-title">医学生智能问诊辅助系统</Title>
          <div className="login-subtitle">Medical Student Intelligent Assistant</div>
        </div>

        {SHOW_TOKEN_LOGIN ? (
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            centered
            className="login-tabs"
            items={[
              {
                key: 'password',
                label: <span><UserOutlined /> 账号登录</span>,
                children: <PasswordLogin onSuccess={handleSuccess} />
              },
              {
                key: 'email',
                label: <span><MailOutlined /> 邮箱登录</span>,
                children: <EmailLogin onSuccess={handleSuccess} />
              },
              {
                key: 'token',
                label: <span><SafetyOutlined /> 令牌登录</span>,
                children: <TokenLogin onSuccess={handleSuccess} />
              }
            ]}
          />
        ) : (
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            centered
            className="login-tabs"
            items={[
              {
                key: 'password',
                label: <span><UserOutlined /> 账号登录</span>,
                children: <PasswordLogin onSuccess={handleSuccess} />
              },
              {
                key: 'email',
                label: <span><MailOutlined /> 邮箱登录</span>,
                children: <EmailLogin onSuccess={handleSuccess} />
              }
            ]}
          />
        )}

        <div className="login-footer">
          <span className="login-footer-text">还没有账号？</span>
          <Link to="/email-register" className="login-footer-link">邮箱注册</Link>
          <span style={{ color: 'var(--msia-border)', margin: '0 8px' }}>|</span>
          <Link to="/register" className="login-footer-link">用户名注册</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
