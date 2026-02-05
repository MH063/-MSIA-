import React, { useState } from 'react';
import { App as AntdApp, Button, Form, Input, Typography, Select, Progress, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, TeamOutlined, MedicineBoxFilled, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import api, { unwrapData, getApiErrorMessage } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import Captcha from '../../components/Captcha';
import './register.css';

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
  captcha: string;
  captchaId: string;
};

/**
 * 计算密码强度
 * @param password 密码
 * @returns 0-100的强度值
 */
const calculatePasswordStrength = (password: string): number => {
  if (!password) return 0;
  
  let strength = 0;
  
  // 长度检查
  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 10;
  
  // 包含小写字母
  if (/[a-z]/.test(password)) strength += 15;
  
  // 包含大写字母
  if (/[A-Z]/.test(password)) strength += 15;
  
  // 包含数字
  if (/\d/.test(password)) strength += 15;
  
  // 包含特殊字符
  if (/[^A-Za-z0-9]/.test(password)) strength += 15;
  
  // 混合多种字符类型额外加分
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

const Register: React.FC = () => {
  const [form] = Form.useForm();
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [password, setPassword] = useState('');
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);

  const strengthInfo = getPasswordStrengthInfo(passwordStrength);
  const isValidUuid = (s: string | undefined) => {
    if (!s) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  };
  const isValidCaptchaCode = (s: string | undefined) => {
    if (!s) return false;
    return /^[A-Za-z0-9]{4}$/.test(s);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
  };

  const handleCaptchaVerify = (isValid: boolean) => {
    setCaptchaVerified(isValid);
  };
  const triggerCaptchaRefresh = () => {
    console.log('[Register] 刷新验证码');
    setCaptchaVerified(false);
    form.setFieldsValue({ captcha: '', captchaId: '' });
    setCaptchaRefreshKey((prev) => prev + 1);
  };

  const onFinish = async (values: RegisterValues) => {
    // 检查密码强度
    if (passwordStrength < 60) {
      message.warning('密码强度不足，请使用更复杂的密码');
      return;
    }

    // 检查验证码
    if (!captchaVerified) {
      message.error('请输入正确的验证码');
      triggerCaptchaRefresh();
      return;
    }
    const idOk = isValidUuid(values.captchaId);
    const codeOk = isValidCaptchaCode(values.captcha);
    if (!idOk || !codeOk) {
      message.error('验证码ID或验证码格式无效，请点击图片刷新后重试');
      triggerCaptchaRefresh();
      return;
    }

    setLoading(true);
    try {
      console.log('[Register] 尝试注册', values);
      const res = (await api.post('/auth/register', values)) as ApiResponse<RegisterResult | { data: RegisterResult }>;
      const payload = unwrapData<RegisterResult>(res);
      
      if (!res?.success || !payload) {
        throw new Error('注册响应无效');
      }

      message.success('注册成功，请登录');
      navigate('/login');
    } catch (err) {
      console.error('[Register] 注册失败', err);
      const msg = getApiErrorMessage(err, '注册失败，请稍后重试');
      if (msg.includes('验证码')) {
        triggerCaptchaRefresh();
      }
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      {/* 背景装饰 */}
      <div className="register-bg-decoration">
        <div className="register-bg-blob register-bg-blob-1" />
        <div className="register-bg-blob register-bg-blob-2" />
        <div className="register-bg-blob register-bg-blob-3" />
      </div>

      {/* 主内容区 */}
      <div className="register-container">
        {/* 左侧品牌区 */}
        <div className="register-brand">
          <div className="register-brand-logo">
            <MedicineBoxFilled />
          </div>
          <h1 className="register-brand-title">医学生智能问诊辅助系统</h1>
          <p className="register-brand-subtitle">Medical Student Intelligent Assistant</p>
          
          <div className="register-brand-features">
            <div className="register-brand-feature">
              <span className="feature-dot" style={{ background: '#722ed1' }} />
              <span>精准诊断训练</span>
            </div>
            <div className="register-brand-feature">
              <span className="feature-dot" style={{ background: '#1677ff' }} />
              <span>丰富病例库</span>
            </div>
            <div className="register-brand-feature">
              <span className="feature-dot" style={{ background: '#52c41a' }} />
              <span>实时智能反馈</span>
            </div>
          </div>
        </div>

        {/* 右侧注册卡片 */}
        <div className="register-card-wrapper">
          <div className="register-card">
            {/* 头部 */}
            <div className="register-header">
              <div className="register-header-icon">
                <SafetyOutlined />
              </div>
              <Title level={3} className="register-title">用户注册</Title>
              <p className="register-subtitle">创建您的账户，开启智能问诊之旅</p>
            </div>

            {/* 注册表单 */}
            <Form 
              form={form} 
              layout="vertical" 
              onFinish={onFinish} 
              size="large"
              className="register-form"
            >
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少3个字符' },
                  { max: 20, message: '用户名最多20个字符' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' }
                ]}
                className="register-form-item"
              >
                <Input 
                  prefix={<UserOutlined className="register-input-icon" />} 
                  placeholder="请输入用户名" 
                  className="register-input"
                  autoComplete="username"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码至少8个字符' },
                ]}
                className="register-form-item"
              >
                <Input.Password 
                  prefix={<LockOutlined className="register-input-icon" />} 
                  placeholder="请输入密码" 
                  className="register-input"
                  autoComplete="new-password"
                  onChange={handlePasswordChange}
                />
              </Form.Item>

              {/* 密码强度指示器 */}
              {password && (
                <div className="password-strength-container">
                  <div className="password-strength-header">
                    <Text type="secondary" className="strength-label">密码强度：</Text>
                    <Text style={{ color: strengthInfo.color }} className="strength-level">
                      {strengthInfo.level}
                    </Text>
                  </div>
                  <Progress 
                    percent={passwordStrength} 
                    status={strengthInfo.status}
                    showInfo={false}
                    strokeColor={strengthInfo.color}
                    className="strength-progress"
                  />
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
                  { max: 20, message: '姓名最多20个字符' }
                ]}
                className="register-form-item"
              >
                <Input 
                  prefix={<UserOutlined className="register-input-icon" />} 
                  placeholder="请输入真实姓名" 
                  className="register-input"
                  autoComplete="name"
                />
              </Form.Item>

              <Form.Item
                name="role"
                initialValue="doctor"
                className="register-form-item"
              >
                <Select
                  prefix={<TeamOutlined className="register-input-icon" />}
                  options={[
                    { label: '医生', value: 'doctor' },
                    { label: '管理员', value: 'admin' },
                  ]}
                  className="register-select"
                  placeholder="请选择角色"
                />
              </Form.Item>

              {/* 验证码 */}
              <Form.Item
                name="captcha"
                rules={[{ required: true, message: '请输入验证码' }]}
                className="register-form-item"
              >
                <Captcha
                  key={`captcha-${captchaRefreshKey}`}
                  onChange={(value) => form.setFieldsValue({ captcha: value })} 
                  onVerify={handleCaptchaVerify}
                  onIdChange={(id) => form.setFieldsValue({ captchaId: id })}
                />
              </Form.Item>
              <Form.Item name="captchaId" initialValue="" hidden>
                <Input type="hidden" />
              </Form.Item>

              <Form.Item className="register-form-item register-submit-item">
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading} 
                  block
                  className="register-button"
                  disabled={passwordStrength < 60 || !captchaVerified}
                >
                  立即注册
                </Button>
              </Form.Item>
              
              <div className="register-footer">
                <Text type="secondary" className="register-footer-text">已有账号？</Text>
                <Link to="/login" className="register-footer-link">去登录</Link>
              </div>
            </Form>
          </div>

          {/* 版权信息 */}
          <div className="register-copyright">
            © 2025 医学生智能问诊辅助系统
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
