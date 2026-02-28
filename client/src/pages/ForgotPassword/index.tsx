import React, { useState, useEffect, useCallback } from 'react';
import { App as AntdApp, Button, Form, Input, Typography, Steps, theme, Result } from 'antd';
import { MailOutlined, LockOutlined, MedicineBoxFilled, SendOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import api, { getApiErrorMessage } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import { useThemeStore } from '../../store/theme.store';
import logger from '../../utils/logger';
import './forgot-password.css';

const { Title, Text } = Typography;

const CODE_EXPIRE_SECONDS = 600;

interface ForgotPasswordFormValues {
  email: string;
  code: string;
  newPassword: string;
}

const ForgotPassword: React.FC = () => {
  const [form] = Form.useForm();
  const { token } = theme.useToken();
  const { mode } = useThemeStore();
  const isDark = mode === 'dark';
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  
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
        type: 'reset_password',
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
      logger.error('[ForgotPassword] 发送验证码失败', err);
      message.error(getApiErrorMessage(err, '发送验证码失败'));
    } finally {
      setSendingCode(false);
    }
  }, [form, message]);
  
  const onFinish = async (values: ForgotPasswordFormValues) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/email/reset-password', {
        email: values.email,
        code: values.code,
        newPassword: values.newPassword,
      }) as ApiResponse<{ message: string }>;
      
      if (res.success) {
        setResetSuccess(true);
        setCurrentStep(2);
        message.success('密码重置成功');
      } else {
        message.error(res.message || '密码重置失败');
      }
    } catch (err) {
      logger.error('[ForgotPassword] 密码重置失败', err);
      message.error(getApiErrorMessage(err, '密码重置失败'));
    } finally {
      setLoading(false);
    }
  };
  
  const steps = [
    { title: '输入邮箱', status: currentStep > 0 ? 'finish' : 'process' },
    { title: '验证身份', status: currentStep > 1 ? 'finish' : currentStep === 1 ? 'process' : 'wait' },
    { title: '重置密码', status: currentStep === 2 ? 'finish' : 'wait' },
  ];
  
  if (resetSuccess) {
    return (
      <div className="forgot-password-page">
        <style>{`
          .forgot-password-page {
            background: ${isDark ? token.colorBgLayout : '#f0f2f5'} !important;
          }
        `}</style>
        
        <div className="forgot-password-bg-decoration">
          <div className="forgot-password-bg-blob forgot-password-bg-blob-1" />
          <div className="forgot-password-bg-blob forgot-password-bg-blob-2" />
        </div>
        
        <div className="forgot-password-card">
          <Result
            status="success"
            title="密码重置成功"
            subTitle="您的密码已成功重置，请使用新密码登录"
            extra={[
              <Button type="primary" key="login" onClick={() => navigate('/login')}>
                前往登录
              </Button>,
            ]}
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="forgot-password-page">
      <style>{`
        .forgot-password-page {
          background: ${isDark ? token.colorBgLayout : '#f0f2f5'} !important;
        }
        .forgot-password-bg-blob {
          opacity: ${isDark ? 0.15 : 0.6} !important;
        }
        .forgot-password-card {
          background: ${token.colorBgContainer} !important;
          border: 1px solid ${token.colorBorderSecondary} !important;
        }
        .forgot-password-input {
          background: ${token.colorBgContainer} !important;
          border-color: ${token.colorBorder} !important;
          color: ${token.colorText} !important;
        }
        .forgot-password-input:hover, .forgot-password-input:focus {
          border-color: ${token.colorPrimary} !important;
        }
        .forgot-password-input-icon {
          color: ${token.colorTextDescription} !important;
        }
        .forgot-password-title {
          color: ${token.colorText} !important;
        }
        .forgot-password-subtitle {
          color: ${token.colorTextSecondary} !important;
        }
      `}</style>
      
      <div className="forgot-password-bg-decoration">
        <div className="forgot-password-bg-blob forgot-password-bg-blob-1" />
        <div className="forgot-password-bg-blob forgot-password-bg-blob-2" />
      </div>
      
      <div className="forgot-password-card">
        <div className="forgot-password-header">
          <div className="forgot-password-logo">
            <MedicineBoxFilled />
          </div>
          <Title level={3} className="forgot-password-title">找回密码</Title>
          <div className="forgot-password-subtitle">通过邮箱验证重置您的密码</div>
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
          className="forgot-password-form"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式无效' },
            ]}
            className="forgot-password-form-item"
          >
            <Input
              prefix={<MailOutlined className="forgot-password-input-icon" style={{ color: token.colorTextPlaceholder }} />}
              placeholder="请输入注册时的邮箱地址"
              className="forgot-password-input"
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
            <Form.Item className="forgot-password-form-item">
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
                className="forgot-password-form-item"
              >
                <Input
                  placeholder="请输入6位验证码"
                  className="forgot-password-input"
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
                name="newPassword"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 8, message: '密码至少8个字符' },
                  { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: '密码需包含字母和数字' },
                ]}
                className="forgot-password-form-item"
              >
                <Input.Password
                  prefix={<LockOutlined className="forgot-password-input-icon" style={{ color: token.colorTextPlaceholder }} />}
                  placeholder="请输入新密码"
                  className="forgot-password-input"
                  autoComplete="new-password"
                  style={{ background: token.colorBgContainer, color: token.colorText }}
                />
              </Form.Item>
              
              <Form.Item
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
                className="forgot-password-form-item"
              >
                <Input.Password
                  prefix={<LockOutlined className="forgot-password-input-icon" style={{ color: token.colorTextPlaceholder }} />}
                  placeholder="请再次输入新密码"
                  className="forgot-password-input"
                  autoComplete="new-password"
                  style={{ background: token.colorBgContainer, color: token.colorText }}
                />
              </Form.Item>
              
              <Form.Item className="forgot-password-form-item">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="forgot-password-button"
                >
                  重置密码
                </Button>
              </Form.Item>
            </>
          )}
        </Form>
        
        <div className="forgot-password-footer">
          <Link to="/login" className="forgot-password-footer-link">返回登录</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
