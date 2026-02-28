import React, { useState, useEffect, useCallback } from 'react';
import { App as AntdApp, Button, Card, Form, Input, Typography, Tabs, theme, Descriptions, Progress, Row, Col } from 'antd';
import { MailOutlined, LockOutlined, SafetyOutlined, SendOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import api, { getApiErrorMessage } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import { useThemeStore } from '../../store/theme.store';
import logger from '../../utils/logger';
import './security-settings.css';

const { Title, Text } = Typography;

type UserInfo = {
  operatorId: number;
  username?: string;
  email?: string;
  name?: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
};

interface PasswordChangeFormValues {
  oldPassword: string;
  newPassword: string;
}

interface EmailChangeFormValues {
  newEmail: string;
  code: string;
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

const getPasswordStrengthInfo = (strength: number) => {
  if (strength < 30) return { level: '弱', color: '#ff4d4f', status: 'exception' as const };
  if (strength < 60) return { level: '中', color: '#faad14', status: 'normal' as const };
  if (strength < 80) return { level: '强', color: '#52c41a', status: 'success' as const };
  return { level: '非常强', color: '#52c41a', status: 'success' as const };
};

const PasswordRequirement: React.FC<{ met: boolean; text: string }> = ({ met, text }) => (
  <div className={`password-requirement ${met ? 'met' : ''}`}>
    {met ? <CheckCircleFilled className="requirement-icon met" /> : <CloseCircleFilled className="requirement-icon" />}
    <span className="requirement-text">{text}</span>
  </div>
);

const SecuritySettings: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = theme.useToken();
  const { mode } = useThemeStore();
  const isDark = mode === 'dark';
  const { message: antdMessage } = AntdApp.useApp();
  
  const [passwordForm] = Form.useForm();
  const [emailForm] = Form.useForm();
  
  const [changingPassword, setChangingPassword] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  
  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await api.get('/auth/email/me') as ApiResponse<UserInfo>;
      if (res.success && res.data) {
        setUserInfo(res.data);
      }
    } catch (err) {
      logger.error('[SecuritySettings] 获取用户信息失败', err);
      antdMessage.error('获取用户信息失败');
    } finally {
      setLoading(false);
    }
  }, [antdMessage]);
  
  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);
  
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
  
  const handlePasswordChange = async (values: PasswordChangeFormValues) => {
    if (passwordStrength < 60) {
      antdMessage.warning('密码强度不足，请使用更复杂的密码');
      return;
    }
    
    setChangingPassword(true);
    try {
      const res = await api.post('/auth/email/change-password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      }) as ApiResponse<{ message: string }>;
      
      if (res.success) {
        antdMessage.success('密码修改成功');
        passwordForm.resetFields();
        setPasswordStrength(0);
        setNewPassword('');
      } else {
        antdMessage.error(res.message || '密码修改失败');
      }
    } catch (err) {
      logger.error('[SecuritySettings] 密码修改失败', err);
      antdMessage.error(getApiErrorMessage(err, '密码修改失败'));
    } finally {
      setChangingPassword(false);
    }
  };
  
  const handleSendCode = useCallback(async () => {
    const newEmail = emailForm.getFieldValue('newEmail');
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      antdMessage.error('请输入有效的邮箱地址');
      return;
    }
    
    if (newEmail === userInfo?.email) {
      antdMessage.error('新邮箱不能与当前邮箱相同');
      return;
    }
    
    setSendingCode(true);
    try {
      const res = await api.post('/auth/email/send-code', {
        email: newEmail,
        type: 'change_email',
      }) as ApiResponse<{ email: string; expiresIn: number }>;
      
      if (res.success) {
        setEmailSent(true);
        setCountdown(CODE_EXPIRE_SECONDS);
        antdMessage.success('验证码已发送到新邮箱');
      } else {
        antdMessage.error(res.message || '发送验证码失败');
      }
    } catch (err) {
      logger.error('[SecuritySettings] 发送验证码失败', err);
      antdMessage.error(getApiErrorMessage(err, '发送验证码失败'));
    } finally {
      setSendingCode(false);
    }
  }, [emailForm, userInfo?.email, antdMessage]);
  
  const handleEmailChange = async (values: EmailChangeFormValues) => {
    setChangingEmail(true);
    try {
      const res = await api.post('/auth/email/change-email', {
        newEmail: values.newEmail,
        code: values.code,
      }) as ApiResponse<{ email: string }>;
      
      if (res.success) {
        antdMessage.success('邮箱修改成功');
        emailForm.resetFields();
        setEmailSent(false);
        fetchUserInfo();
      } else {
        antdMessage.error(res.message || '邮箱修改失败');
      }
    } catch (err) {
      logger.error('[SecuritySettings] 邮箱修改失败', err);
      antdMessage.error(getApiErrorMessage(err, '邮箱修改失败'));
    } finally {
      setChangingEmail(false);
    }
  };
  
  const strengthInfo = getPasswordStrengthInfo(passwordStrength);
  
  if (loading) {
    return (
      <div className="security-settings-page">
        <Card loading={true} style={{ maxWidth: 800, margin: '0 auto' }} />
      </div>
    );
  }
  
  const ChangePasswordTab = () => (
    <Form
      form={passwordForm}
      layout="vertical"
      onFinish={handlePasswordChange}
      className="security-settings-form"
    >
      <Form.Item
        name="oldPassword"
        label="当前密码"
        rules={[{ required: true, message: '请输入当前密码' }]}
      >
        <Input.Password
          prefix={<LockOutlined style={{ color: token.colorTextPlaceholder }} />}
          placeholder="请输入当前密码"
          style={{ background: token.colorBgContainer, color: token.colorText }}
        />
      </Form.Item>
      
      <Form.Item
        name="newPassword"
        label="新密码"
        rules={[
          { required: true, message: '请输入新密码' },
          { min: 8, message: '密码至少8个字符' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined style={{ color: token.colorTextPlaceholder }} />}
          placeholder="请输入新密码"
          onChange={(e) => {
            setNewPassword(e.target.value);
            setPasswordStrength(calculatePasswordStrength(e.target.value));
          }}
          style={{ background: token.colorBgContainer, color: token.colorText }}
        />
      </Form.Item>
      
      {newPassword && (
        <div className="password-strength-container" style={{ marginBottom: 16 }}>
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
                <PasswordRequirement met={newPassword.length >= 8} text="至少8个字符" />
              </Col>
              <Col span={12}>
                <PasswordRequirement met={/[a-z]/.test(newPassword)} text="包含小写字母" />
              </Col>
              <Col span={12}>
                <PasswordRequirement met={/[A-Z]/.test(newPassword)} text="包含大写字母" />
              </Col>
              <Col span={12}>
                <PasswordRequirement met={/\d/.test(newPassword)} text="包含数字" />
              </Col>
              <Col span={12}>
                <PasswordRequirement met={/[^A-Za-z0-9]/.test(newPassword)} text="包含特殊字符" />
              </Col>
            </Row>
          </div>
        </div>
      )}
      
      <Form.Item
        name="confirmPassword"
        label="确认新密码"
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
      >
        <Input.Password
          prefix={<LockOutlined style={{ color: token.colorTextPlaceholder }} />}
          placeholder="请再次输入新密码"
          style={{ background: token.colorBgContainer, color: token.colorText }}
        />
      </Form.Item>
      
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={changingPassword}
          disabled={passwordStrength < 60}
        >
          修改密码
        </Button>
      </Form.Item>
    </Form>
  );
  
  const ChangeEmailTab = () => (
    <Form
      form={emailForm}
      layout="vertical"
      onFinish={handleEmailChange}
      className="security-settings-form"
    >
      <Form.Item label="当前邮箱">
        <Input
          value={userInfo?.email || '未绑定'}
          disabled
          prefix={<MailOutlined style={{ color: token.colorTextPlaceholder }} />}
          style={{ background: token.colorBgContainer, color: token.colorText }}
        />
      </Form.Item>
      
      <Form.Item
        name="newEmail"
        label="新邮箱"
        rules={[
          { required: true, message: '请输入新邮箱' },
          { type: 'email', message: '邮箱格式无效' },
        ]}
      >
        <Input
          prefix={<MailOutlined style={{ color: token.colorTextPlaceholder }} />}
          placeholder="请输入新邮箱地址"
          disabled={emailSent}
          style={{ background: token.colorBgContainer, color: token.colorText }}
        />
      </Form.Item>
      
      {!emailSent && (
        <Form.Item>
          <Button
            type="primary"
            onClick={handleSendCode}
            loading={sendingCode}
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
            label="验证码"
            rules={[
              { required: true, message: '请输入验证码' },
              { len: 6, message: '验证码为6位数字' },
              { pattern: /^\d{6}$/, message: '验证码只能包含数字' },
            ]}
          >
            <Input
              placeholder="请输入6位验证码"
              maxLength={6}
              style={{ background: token.colorBgContainer, color: token.colorText }}
            />
          </Form.Item>
          
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              验证码已发送至新邮箱
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
          
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={changingEmail}
            >
              修改邮箱
            </Button>
          </Form.Item>
        </>
      )}
    </Form>
  );
  
  return (
    <div className="security-settings-page">
      <style>{`
        .security-settings-page {
          background: ${isDark ? token.colorBgLayout : '#f0f2f5'} !important;
        }
        .security-settings-card {
          background: ${token.colorBgContainer} !important;
          border: 1px solid ${token.colorBorderSecondary} !important;
        }
        .security-settings-title {
          color: ${token.colorText} !important;
        }
        .password-requirement {
          color: ${token.colorTextSecondary};
        }
        .password-requirement.met {
          color: ${token.colorText};
        }
      `}</style>
      
      <div className="security-settings-container">
        <Title level={3} className="security-settings-title" style={{ marginBottom: 24 }}>
          <SafetyOutlined style={{ marginRight: 8 }} />
          账户安全设置
        </Title>
        
        <Card className="security-settings-card" style={{ marginBottom: 24 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="用户ID">{userInfo?.operatorId}</Descriptions.Item>
            <Descriptions.Item label="用户名">{userInfo?.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="姓名">{userInfo?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="角色">{userInfo?.role === 'admin' ? '管理员' : '医生'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{userInfo?.email || '未绑定'}</Descriptions.Item>
            <Descriptions.Item label="邮箱验证">
              {userInfo?.emailVerified ? (
                <Text type="success">已验证</Text>
              ) : (
                <Text type="warning">未验证</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        
        <Card className="security-settings-card">
          <Tabs
            items={[
              {
                key: 'password',
                label: <span><LockOutlined /> 修改密码</span>,
                children: <ChangePasswordTab />,
              },
              {
                key: 'email',
                label: <span><MailOutlined /> 修改邮箱</span>,
                children: <ChangeEmailTab />,
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

export default SecuritySettings;
