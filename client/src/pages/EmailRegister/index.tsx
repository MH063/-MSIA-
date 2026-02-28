import React, { useState, useEffect, useCallback } from 'react';
import { Button, Form, Input, Typography, Select, Progress, Row, Col, theme, Steps, message } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined, MedicineBoxFilled, CheckCircleFilled, CloseCircleFilled, SendOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import api, { unwrapData, getApiErrorMessage } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import { useThemeStore } from '../../store/theme.store';
import logger from '../../utils/logger';
import './email-register.css';

const { Title, Text } = Typography;

type RegisterResult = {
  operatorId: number;
  role: 'admin' | 'doctor';
  name: string;
  email: string;
  token?: string;
};

type StepStatus = 'wait' | 'process' | 'finish' | 'error';

interface EmailRegisterFormValues {
  email: string;
  password: string;
  name: string;
  code: string;
  role?: 'admin' | 'doctor';
}

const CODE_EXPIRE_SECONDS = 600;

/**
 * 计算密码强度
 */
const calculatePasswordStrength = (password: string): number => {
  if (!password) return 0;
  
  let strength = 0;
  
  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 10;
  if (/[a-z]/.test(password)) strength += 15;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/\d/.test(password)) strength += 15;
  if (/[^A-Za-z0-9]/.test(password)) strength += 15;
  
  const types = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;
  
  if (types >= 3) strength += 10;
  
  return Math.min(100, strength);
};

/**
 * 获取密码强度等级和颜色
 */
const getPasswordStrengthInfo = (strength: number) => {
  if (strength < 30) return { level: '弱', color: '#ff4d4f', status: 'exception' as const };
  if (strength < 60) return { level: '中', color: '#faad14', status: 'normal' as const };
  if (strength < 80) return { level: '强', color: '#52c41a', status: 'success' as const };
  return { level: '非常强', color: '#52c41a', status: 'success' as const };
};

/**
 * 密码要求检查项
 */
const PasswordRequirement: React.FC<{ met: boolean; text: string }> = ({ met, text }) => (
  <div className={`password-requirement ${met ? 'met' : ''}`}>
    {met ? <CheckCircleFilled className="requirement-icon met" /> : <CloseCircleFilled className="requirement-icon" />}
    <span className="requirement-text">{text}</span>
  </div>
);

const EmailRegister: React.FC = () => {
  const [form] = Form.useForm();
  const { token } = theme.useToken();
  const { mode } = useThemeStore();
  const isDark = mode === 'dark';
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [password, setPassword] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState('');
  
  const strengthInfo = getPasswordStrengthInfo(passwordStrength);
  
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
  };
  
  const handleSendCode = useCallback(async () => {
    try {
      const emailValue = form.getFieldValue('email');
      if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        message.error('请输入有效的邮箱地址');
        return;
      }
      
      setSendingCode(true);
      
      const res = await api.post('/auth/email/send-code', {
        email: emailValue,
        type: 'register',
      }) as ApiResponse<{ email: string; expiresIn: number }>;
      
      if (res.success) {
        setEmail(emailValue);
        setEmailSent(true);
        setCountdown(CODE_EXPIRE_SECONDS);
        setCurrentStep(1);
        message.success('验证码已发送到您的邮箱');
      } else {
        message.error(res.message || '发送验证码失败');
      }
    } catch (err) {
      logger.error('[EmailRegister] 发送验证码失败', err);
      message.error(getApiErrorMessage(err, '发送验证码失败'));
    } finally {
      setSendingCode(false);
    }
  }, [form]);
  
  const onFinish = async (values: EmailRegisterFormValues) => {
    if (passwordStrength < 60) {
      message.warning('密码强度不足，请使用更复杂的密码');
      return;
    }
    
    setLoading(true);
    try {
      const res = await api.post('/auth/email/register', {
        email: values.email,
        password: values.password,
        name: values.name,
        code: values.code,
        role: values.role || 'doctor',
      }) as ApiResponse<RegisterResult>;
      
      const payload = unwrapData<RegisterResult>(res);
      
      if (!res?.success || !payload) {
        throw new Error('注册响应无效');
      }
      
      message.success('注册成功');
      navigate('/home', { replace: true });
    } catch (err) {
      logger.error('[EmailRegister] 注册失败', err);
      message.error(getApiErrorMessage(err, '注册失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };
  
  const steps: { title: string; status: StepStatus }[] = [
    { title: '输入邮箱', status: currentStep > 0 ? 'finish' : currentStep === 0 ? 'process' : 'wait' },
    { title: '验证邮箱', status: currentStep > 1 ? 'finish' : currentStep === 1 ? 'process' : 'wait' },
    { title: '设置密码', status: currentStep > 2 ? 'finish' : currentStep === 2 ? 'process' : 'wait' },
  ];
  
  return (
    <div className="email-register-page">
      <style>{`
        .email-register-page {
          background: ${isDark ? token.colorBgLayout : '#f0f2f5'} !important;
        }
        .email-register-bg-blob {
          opacity: ${isDark ? 0.15 : 0.6} !important;
        }
        .email-register-card {
          background: ${token.colorBgContainer} !important;
          border: 1px solid ${token.colorBorderSecondary} !important;
        }
        .email-register-input {
          background: ${token.colorBgContainer} !important;
          border-color: ${token.colorBorder} !important;
          color: ${token.colorText} !important;
        }
        .email-register-input:hover, .email-register-input:focus {
          border-color: ${token.colorPrimary} !important;
        }
        .email-register-input-icon {
          color: ${token.colorTextDescription} !important;
        }
        .password-requirement {
          color: ${token.colorTextSecondary};
        }
        .password-requirement.met {
          color: ${token.colorText};
        }
        .email-register-title {
          color: ${token.colorText} !important;
        }
        .email-register-subtitle {
          color: ${token.colorTextSecondary} !important;
        }
        .ant-steps-item-title {
          color: ${token.colorText} !important;
        }
      `}</style>
      
      <div className="email-register-bg-decoration">
        <div className="email-register-bg-blob email-register-bg-blob-1" />
        <div className="email-register-bg-blob email-register-bg-blob-2" />
      </div>
      
      <div className="email-register-card">
        <div className="email-register-header">
          <div className="email-register-logo">
            <MedicineBoxFilled />
          </div>
          <Title level={3} className="email-register-title">邮箱注册</Title>
          <div className="email-register-subtitle">创建您的账户，开启智能问诊之旅</div>
        </div>
        
        <Steps
          current={currentStep}
          items={steps}
          size="small"
          style={{ marginBottom: 24 }}
        />
        
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          size="large"
          className="email-register-form"
          initialValues={{ role: 'doctor' }}
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式无效' },
            ]}
            className="email-register-form-item"
          >
            <Input
              prefix={<MailOutlined className="email-register-input-icon" style={{ color: token.colorTextPlaceholder }} />}
              placeholder="请输入邮箱地址"
              className="email-register-input"
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              disabled={emailSent}
              suffix={
                emailSent ? (
                  <CheckCircleFilled style={{ color: '#52c41a' }} />
                ) : null
              }
              style={{ background: token.colorBgContainer, color: token.colorText }}
            />
          </Form.Item>
          
          {!emailSent && (
            <Form.Item className="email-register-form-item">
              <Button
                type="primary"
                onClick={handleSendCode}
                loading={sendingCode}
                block
                icon={<SendOutlined />}
              >
                发送验证码
              </Button>
            </Form.Item>
          )}
          
          {emailSent && (
            <>
              <Form.Item
                name="code"
                rules={[
                  { required: true, message: '请输入验证码' },
                  { len: 6, message: '验证码为6位数字' },
                  { pattern: /^\d{6}$/, message: '验证码只能包含数字' },
                ]}
                className="email-register-form-item"
              >
                <Input
                  placeholder="请输入6位验证码"
                  className="email-register-input"
                  maxLength={6}
                  style={{ background: token.colorBgContainer, color: token.colorText }}
                />
              </Form.Item>
              
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  验证码已发送至 {email}
                </Text>
                <Button
                  type="link"
                  onClick={handleSendCode}
                  disabled={countdown > 0}
                  loading={sendingCode}
                  style={{ padding: 0, height: 'auto' }}
                >
                  {countdown > 0 ? `${countdown}秒后可重发` : '重新发送'}
                </Button>
              </div>
              
              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码至少8个字符' },
                ]}
                className="email-register-form-item"
              >
                <Input.Password
                  prefix={<LockOutlined className="email-register-input-icon" style={{ color: token.colorTextPlaceholder }} />}
                  placeholder="请输入密码"
                  className="email-register-input"
                  autoComplete="new-password"
                  onChange={handlePasswordChange}
                  style={{ background: token.colorBgContainer, color: token.colorText }}
                />
              </Form.Item>
              
              {password && (
                <div className="password-strength-container">
                  <div className="password-strength-bar">
                    <Progress
                      percent={passwordStrength}
                      status={strengthInfo.status}
                      showInfo={false}
                      strokeColor={strengthInfo.color}
                      size="small"
                    />
                  </div>
                  <div className="password-requirements">
                    <Row gutter={[8, 8]}>
                      <Col span={12}>
                        <PasswordRequirement met={password.length >= 8} text="至少8个字符" />
                      </Col>
                      <Col span={12}>
                        <PasswordRequirement met={/[a-z]/.test(password)} text="包含小写字母" />
                      </Col>
                      <Col span={12}>
                        <PasswordRequirement met={/[A-Z]/.test(password)} text="包含大写字母" />
                      </Col>
                      <Col span={12}>
                        <PasswordRequirement met={/\d/.test(password)} text="包含数字" />
                      </Col>
                      <Col span={12}>
                        <PasswordRequirement met={/[^A-Za-z0-9]/.test(password)} text="包含特殊字符" />
                      </Col>
                    </Row>
                  </div>
                </div>
              )}
              
              <Form.Item
                name="name"
                rules={[
                  { required: true, message: '请输入姓名' },
                  { min: 2, message: '姓名至少2个字符' },
                  { max: 20, message: '姓名最多20个字符' },
                ]}
                className="email-register-form-item"
              >
                <Input
                  prefix={<UserOutlined className="email-register-input-icon" />}
                  placeholder="请输入真实姓名"
                  className="email-register-input"
                  autoComplete="name"
                />
              </Form.Item>
              
              <Form.Item
                name="role"
                className="email-register-form-item"
              >
                <Select
                  options={[
                    { label: '医生', value: 'doctor' },
                    { label: '管理员', value: 'admin' },
                  ]}
                  placeholder="请选择角色"
                />
              </Form.Item>
              
              <Form.Item className="email-register-form-item">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="email-register-button"
                  disabled={passwordStrength < 60}
                >
                  注册
                </Button>
              </Form.Item>
            </>
          )}
        </Form>
        
        <div className="email-register-footer">
          <span className="email-register-footer-text">已有账号？</span>
          <Link to="/login" className="email-register-footer-link">立即登录</Link>
        </div>
      </div>
    </div>
  );
};

export default EmailRegister;
