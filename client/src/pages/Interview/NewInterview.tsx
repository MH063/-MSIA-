import React, { useState, useEffect, useCallback } from 'react';
import { 
  App as AntdApp, 
  Button, 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  Card, 
  Row, 
  Col, 
  Space, 
  Typography, 
  Steps, 
  Divider,
  Avatar,
  Badge,
  InputNumber,
  Alert
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  UserOutlined, 
  MedicineBoxOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  IdcardOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import api, { unwrapData } from '../../utils/api';
import { computeAgeDisplay, formatAgeText, normalizeAge } from '../../utils/age';
import AgeDisplayView from './components/Editor/AgeDisplay';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * 患者基本信息表单字段类型
 * 与问诊导航中"一般项目"模块保持一致的字段结构
 */
interface PatientBasicInfo {
  // 核心身份信息
  name: string;
  gender: string;
  birthDate?: Dayjs;
  age?: number;
  ageYears?: number;
  ageMonthsPart?: number;
  ageMonthsTotal?: number;
  ageDisplayText?: string;
  ageDisplayBackupText?: string;
  ethnicity: string;
  
  // 社会背景
  nativePlace?: string;
  placeOfBirth?: string;
  occupation?: string;
  employer?: string;
  address?: string;
  phone: string;
  
  // 婚姻状况
  maritalStatus?: string;
  
  // 问诊配置
  historian: string;
  reliability: string;
  historianRelationship?: string;
  
  // 记录信息
  admissionTime?: Dayjs;
  recordTime?: Dayjs;
}

/**
 * 表单步骤配置
 */
const formSteps = [
  { title: '身份信息', icon: <UserOutlined />, key: 'identity' },
  { title: '联系方式', icon: <PhoneOutlined />, key: 'contact' },
  { title: '问诊配置', icon: <CheckCircleOutlined />, key: 'config' },
];

/**
 * 将表单数据转换为会话数据格式
 * 确保与问诊导航中 GeneralSection 的数据结构一致
 */
const convertToSessionFormat = (values: PatientBasicInfo) => {
  return {
    // 患者基本信息
    name: values.name,
    gender: values.gender,
    birthDate: values.birthDate,
    ethnicity: values.ethnicity,
    nativePlace: values.nativePlace,
    placeOfBirth: values.placeOfBirth,
    occupation: values.occupation,
    employer: values.employer,
    address: values.address,
    phone: values.phone,
    
    // 年龄相关
    age: values.age,
    ageYears: values.ageYears,
    ageMonthsPart: values.ageMonthsPart,
    ageMonthsTotal: values.ageMonthsTotal,
    ageDisplayText: values.ageDisplayText,
    ageDisplayBackupText: values.ageDisplayBackupText,
    
    // 婚姻状况
    maritalHistory: {
      status: values.maritalStatus
    },
    
    // 问诊配置
    historian: values.historian,
    reliability: values.reliability,
    historianRelationship: values.historianRelationship,
    
    // 记录信息
    generalInfo: {
      admissionTime: values.admissionTime,
      recordTime: values.recordTime || dayjs()
    }
  };
};



const NewInterview: React.FC = () => {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  
  // 监听表单字段变化
  const birthDate = Form.useWatch('birthDate', form);
  const recordTime = Form.useWatch('recordTime', form);
  const historian = Form.useWatch('historian', form);
  const ageYears = Form.useWatch('ageYears', form) as number | undefined;
  const ageMonthsPart = Form.useWatch('ageMonthsPart', form) as number | undefined;

  /**
   * 自动计算年龄显示
   */
  useEffect(() => {
    const ref = recordTime ?? dayjs();
    const display = computeAgeDisplay(birthDate, ref);
    if (!display) return;
    
    const patch: Record<string, unknown> = {};
    if (form.getFieldValue('age') !== display.yearsFloat) patch.age = display.yearsFloat;
    if (form.getFieldValue('ageYears') !== display.yearsPart) patch.ageYears = display.yearsPart;
    if (form.getFieldValue('ageMonthsTotal') !== display.totalMonthsInt) patch.ageMonthsTotal = display.totalMonthsInt;
    if (form.getFieldValue('ageMonthsPart') !== display.monthsPart) patch.ageMonthsPart = display.monthsPart;
    if (form.getFieldValue('ageDisplayText') !== display.mainText) patch.ageDisplayText = display.mainText;
    if (form.getFieldValue('ageDisplayBackupText') !== (display.backupText ?? '')) patch.ageDisplayBackupText = display.backupText ?? '';

    if (Object.keys(patch).length > 0) {
      form.setFieldsValue(patch);
    }
  }, [birthDate, recordTime, form]);

  /**
   * 手动输入年龄时的处理
   */
  useEffect(() => {
    const display = computeAgeDisplay(birthDate, recordTime ?? dayjs());
    if (display) return;

    const hasYears = typeof ageYears === 'number' && Number.isFinite(ageYears);
    const hasMonths = typeof ageMonthsPart === 'number' && Number.isFinite(ageMonthsPart);
    if (!hasYears && !hasMonths) return;

    const normalized = normalizeAge({ years: hasYears ? ageYears : 0, months: hasMonths ? ageMonthsPart : 0 });
    const yearsFloat = Math.round((normalized.totalMonths / 12) * 100) / 100;
    const nextDisplayText = formatAgeText(normalized.years, normalized.months, 'auto', 'years_months');
    
    const patch: Record<string, unknown> = {};
    if (form.getFieldValue('ageYears') !== normalized.years) patch.ageYears = normalized.years;
    if (form.getFieldValue('ageMonthsPart') !== normalized.months) patch.ageMonthsPart = normalized.months;
    if (form.getFieldValue('ageMonthsTotal') !== normalized.totalMonths) patch.ageMonthsTotal = normalized.totalMonths;
    if (form.getFieldValue('age') !== yearsFloat) patch.age = yearsFloat;
    if (form.getFieldValue('ageDisplayText') !== nextDisplayText) patch.ageDisplayText = nextDisplayText;
    if (form.getFieldValue('ageDisplayBackupText') !== '') patch.ageDisplayBackupText = '';

    if (Object.keys(patch).length > 0) {
      form.setFieldsValue(patch);
    }
  }, [birthDate, recordTime, ageYears, ageMonthsPart, form]);

  /**
   * 当陈述者为本人时，清空关系字段
   */
  useEffect(() => {
    if (historian === '本人') {
      const prev = form.getFieldValue('historianRelationship');
      if (prev !== undefined && prev !== '') {
        form.setFieldValue('historianRelationship', undefined);
      }
    }
  }, [historian, form]);

  /**
   * 计算年龄显示
   */
  const ageDisplay = React.useMemo(() => {
    return computeAgeDisplay(birthDate, recordTime ?? dayjs()) ?? undefined;
  }, [birthDate, recordTime]);

  /**
   * 表单提交处理
   * 创建患者和会话，数据结构与 GeneralSection 保持一致
   */
  const onFinish = async (values: PatientBasicInfo) => {
    setLoading(true);
    setSyncStatus('syncing');
    
    try {
      console.log('[NewInterview] 提交表单数据', values);
      
      // 1. 创建患者
      const patientRes = await api.post('/patients', {
        name: values.name,
        gender: values.gender,
        birthDate: values.birthDate ? values.birthDate.format('YYYY-MM-DD') : undefined,
        ethnicity: values.ethnicity,
        nativePlace: values.nativePlace,
        placeOfBirth: values.placeOfBirth,
        address: values.address,
        occupation: values.occupation,
        employer: values.employer,
        contactInfo: { phone: values.phone }
      }) as unknown as import('../../utils/api').ApiResponse<{ id: string }>;

      const patientData = unwrapData<{ id: string }>(patientRes);
      if (!patientData) {
        throw new Error('患者创建失败');
      }
      
      const patientId = patientData.id;
      
      // 2. 创建会话 - 使用与 GeneralSection 一致的数据结构
      try {
        const sessionData = convertToSessionFormat(values);
        console.log('[NewInterview] 会话数据结构', sessionData);
        
        const sessionRes = await api.post('/sessions', {
          patientId: patientId,
          ...sessionData,
          // 确保数据同步标记
          syncVersion: Date.now()
        }) as unknown as import('../../utils/api').ApiResponse<{ id: string }>;

        const sessionResult = unwrapData<{ id: string }>(sessionRes);
        if (sessionResult) {
          console.log('[NewInterview] 创建会话成功', sessionResult);
          setSyncStatus('synced');
          message.success('患者档案创建成功，数据已同步到问诊系统');
          navigate(`/interview/${sessionResult.id}`);
          return;
        } else {
          throw new Error('会话创建失败');
        }
      } catch (err) {
        console.error('[NewInterview] 创建会话失败:', err);
        // 回滚患者记录
        try {
          await api.delete(`/patients/${patientId}`) as unknown as import('../../utils/api').ApiResponse;
          message.error('会话创建失败，已回滚患者记录');
        } catch (rollbackErr) {
          console.error('[NewInterview] 患者回滚失败:', rollbackErr);
          message.error('会话创建失败，患者回滚失败，请手动处理');
        }
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('[NewInterview] 创建失败:', error);
      message.error('创建失败，请检查网络连接后重试');
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 暂存草稿
   */
  const handleSaveDraft = useCallback(async () => {
    const values = form.getFieldsValue();
    if (!values.name) {
      message.warning('至少需要填写姓名才能保存草稿');
      return;
    }
    
    try {
      localStorage.setItem('interview_draft', JSON.stringify(values));
      message.success('草稿已保存到本地');
    } catch {
      message.error('保存草稿失败');
    }
  }, [form, message]);

  /**
   * 加载草稿
   */
  useEffect(() => {
    try {
      const draft = localStorage.getItem('interview_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        // 转换日期字符串回 Dayjs 对象
        if (parsed.birthDate) parsed.birthDate = dayjs(parsed.birthDate);
        if (parsed.recordTime) parsed.recordTime = dayjs(parsed.recordTime);
        if (parsed.admissionTime) parsed.admissionTime = dayjs(parsed.admissionTime);
        
        form.setFieldsValue(parsed);
        message.info('已恢复上次草稿');
      }
    } catch (e) {
      console.error('[NewInterview] 加载草稿失败', e);
    }
  }, [form, message]);

  /**
   * 步骤切换验证
   */
  const handleStepChange = async (step: number) => {
    // 验证当前步骤的必填字段
    const currentFields = step === 0 
      ? ['name', 'gender', 'ethnicity']
      : step === 1 
        ? ['phone']
        : [];
    
    if (currentFields.length > 0) {
      try {
        await form.validateFields(currentFields);
      } catch {
        message.warning('请完成当前步骤的必填项');
        return;
      }
    }
    
    setCurrentStep(step);
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f7ff 50%, #f0f9ff 100%)',
      padding: '24px'
    }}>
      {/* 页面头部 */}
      <div style={{ 
        maxWidth: 1000, 
        margin: '0 auto 32px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: 16 }}>
          <Avatar 
            size={64} 
            icon={<MedicineBoxOutlined />} 
            style={{ 
              background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
              boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)'
            }} 
          />
        </div>
        <Title level={2} style={{ marginBottom: 8, color: '#262626' }}>
          开始新问诊
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          建立患者档案，数据将自动同步到问诊系统
        </Text>
      </div>

      {/* 步骤条 */}
      <div style={{ maxWidth: 800, margin: '0 auto 32px' }}>
        <Steps 
          current={currentStep} 
          onChange={handleStepChange}
          items={formSteps.map(step => ({
            title: step.title,
            icon: step.icon,
          }))}
          style={{ 
            background: '#fff', 
            padding: '24px 48px', 
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
          }}
        />
      </div>

      {/* 同步状态提示 */}
      {syncStatus === 'error' && (
        <div style={{ maxWidth: 800, margin: '0 auto 16px' }}>
          <Alert
            message="数据同步失败"
            description="请检查网络连接后重试，或联系管理员"
            type="error"
            showIcon
            closable
            onClose={() => setSyncStatus('idle')}
          />
        </div>
      )}

      {/* 表单区域 */}
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Form 
          form={form} 
          layout="vertical" 
          onFinish={onFinish}
          size="large"
          initialValues={{
            ethnicity: '汉族',
            historian: '本人',
            reliability: '可靠',
            recordTime: dayjs()
          }}
        >
          {/* 步骤1: 身份信息 */}
          <Card 
            style={{ 
              marginBottom: 24, 
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: 'none',
              display: currentStep === 0 ? 'block' : 'none'
            }}
            styles={{ body: { padding: '32px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
              <Avatar 
                size={40} 
                icon={<UserOutlined />} 
                style={{ 
                  background: 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)',
                  marginRight: 16
                }} 
              />
              <div>
                <Title level={4} style={{ margin: 0 }}>患者身份信息</Title>
                <Text type="secondary">请填写患者的基本身份信息，与问诊系统保持一致</Text>
              </div>
            </div>

            <Row gutter={24}>
              <Col span={8}>
                <Form.Item 
                  name="name" 
                  label={<Space><IdcardOutlined />姓名</Space>} 
                  rules={[{ required: true, message: '请输入患者姓名' }]}
                >
                  <Input 
                    placeholder="请输入患者姓名" 
                    size="large"
                    style={{ borderRadius: 8 }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item 
                  name="gender" 
                  label={<Space><TeamOutlined />性别</Space>} 
                  rules={[{ required: true, message: '请选择性别' }]}
                >
                  <Select 
                    placeholder="请选择性别"
                    size="large"
                    style={{ borderRadius: 8 }}
                  >
                    <Option value="男">
                      <Badge color="blue" text="男" />
                    </Option>
                    <Option value="女">
                      <Badge color="pink" text="女" />
                    </Option>
                    <Option value="其他">
                      <Badge color="default" text="其他" />
                    </Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item 
                  name="ethnicity" 
                  label={<Space><TeamOutlined />民族</Space>}
                  rules={[{ required: true, message: '请输入民族' }]}
                >
                  <Input 
                    placeholder="如：汉族" 
                    size="large"
                    style={{ borderRadius: 8 }}
                  />
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item name="birthDate" label={<Space><CalendarOutlined />出生日期</Space>}>
                  <DatePicker 
                    style={{ width: '100%', borderRadius: 8 }} 
                    size="large"
                    placeholder="选择出生日期"
                  />
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item
                  label={<Space><CalendarOutlined />年龄</Space>}
                  help={ageDisplay?.backupText ? `备用：${ageDisplay.backupText}` : '出生日期填写后自动计算'}
                  required
                >
                  {ageDisplay ? (
                    <div style={{ 
                      width: '100%', 
                      minHeight: 40, 
                      display: 'flex', 
                      alignItems: 'center', 
                      background: '#f6ffed', 
                      border: '1px solid #b7eb8f', 
                      borderRadius: 8, 
                      padding: '0 11px' 
                    }}>
                      <AgeDisplayView display={ageDisplay} />
                    </div>
                  ) : (
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item
                        name="ageYears"
                        noStyle
                        rules={[
                          { required: !birthDate, message: '请输入年龄' },
                          {
                            validator: (_rule, value) => {
                              if (value === null || value === undefined || value === '') return Promise.resolve();
                              const n = typeof value === 'number' ? value : Number(String(value));
                              if (Number.isFinite(n) && n >= 0 && n <= 150) return Promise.resolve();
                              return Promise.reject(new Error('请输入有效年龄'));
                            }
                          }
                        ]}
                      >
                        <InputNumber
                          style={{ width: '60%' }}
                          placeholder="岁"
                          min={0}
                          max={150}
                          suffix="岁"
                        />
                      </Form.Item>
                      <Form.Item name="ageMonthsPart" noStyle>
                        <InputNumber
                          style={{ width: '40%' }}
                          placeholder="月"
                          min={0}
                          max={11}
                          suffix="月"
                        />
                      </Form.Item>
                    </Space.Compact>
                  )}
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item 
                  name="maritalStatus" 
                  label={<Space><TeamOutlined />婚姻状况</Space>}
                  rules={[{ required: true, message: '请选择婚姻状况' }]}
                >
                  <Select placeholder="选择婚姻状况" size="large" style={{ borderRadius: 8 }}>
                    <Option value="未婚">未婚</Option>
                    <Option value="已婚">已婚</Option>
                    <Option value="离异">离异</Option>
                    <Option value="丧偶">丧偶</Option>
                  </Select>
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item name="nativePlace" label={<Space><EnvironmentOutlined />籍贯</Space>}>
                  <Input placeholder="省/市" size="large" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="placeOfBirth" label={<Space><EnvironmentOutlined />出生地</Space>}>
                  <Input placeholder="省/市/县" size="large" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="occupation" label={<Space><IdcardOutlined />职业</Space>}>
                  <Input placeholder="患者职业" size="large" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Button 
                type="primary" 
                size="large"
                onClick={() => handleStepChange(1)}
                style={{ 
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
                  border: 'none',
                  padding: '0 48px'
                }}
              >
                下一步 <ArrowRightOutlined />
              </Button>
            </div>
          </Card>

          {/* 步骤2: 联系方式 */}
          <Card 
            style={{ 
              marginBottom: 24, 
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: 'none',
              display: currentStep === 1 ? 'block' : 'none'
            }}
            styles={{ body: { padding: '32px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
              <Avatar 
                size={40} 
                icon={<PhoneOutlined />} 
                style={{ 
                  background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
                  marginRight: 16
                }} 
              />
              <div>
                <Title level={4} style={{ margin: 0 }}>联系方式</Title>
                <Text type="secondary">请填写患者的联系方式和地址信息</Text>
              </div>
            </div>

            <Row gutter={24}>
              <Col span={8}>
                <Form.Item 
                  name="phone" 
                  label={<Space><PhoneOutlined />联系电话</Space>}
                  rules={[
                    { required: true, message: '请输入联系电话' },
                    { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的11位手机号码' }
                  ]}
                >
                  <Input 
                    placeholder="11位手机号" 
                    size="large"
                    style={{ borderRadius: 8 }}
                    maxLength={11}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="employer" label={<Space><IdcardOutlined />工作单位</Space>}>
                  <Input placeholder="工作单位" size="large" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="address" label={<Space><EnvironmentOutlined />联系地址</Space>}>
                  <Input placeholder="详细居住地址" size="large" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '24px 0' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Avatar 
                size={32} 
                icon={<CalendarOutlined />} 
                style={{ 
                  background: '#722ed1',
                  marginRight: 12
                }} 
              />
              <Text strong>记录信息</Text>
            </div>
            
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item name="admissionTime" label="入院时间">
                  <DatePicker 
                    showTime 
                    format="YYYY-MM-DD HH:mm" 
                    style={{ width: '100%', borderRadius: 8 }} 
                    placeholder="年-月-日 时:分" 
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item 
                  name="recordTime" 
                  label="记录时间"
                  rules={[{ required: true, message: '请选择记录时间' }]}
                >
                  <DatePicker 
                    showTime 
                    format="YYYY-MM-DD HH:mm" 
                    style={{ width: '100%', borderRadius: 8 }} 
                    placeholder="年-月-日 时:分" 
                  />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', justifyContent: 'center', gap: 16 }}>
              <Button 
                size="large"
                onClick={() => setCurrentStep(0)}
                style={{ borderRadius: 8 }}
              >
                上一步
              </Button>
              <Button 
                type="primary" 
                size="large"
                onClick={() => handleStepChange(2)}
                style={{ 
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
                  border: 'none',
                  padding: '0 48px'
                }}
              >
                下一步 <ArrowRightOutlined />
              </Button>
            </div>
          </Card>

          {/* 步骤3: 问诊配置 */}
          <Card 
            style={{ 
              marginBottom: 24, 
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: 'none',
              display: currentStep === 2 ? 'block' : 'none'
            }}
            styles={{ body: { padding: '32px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
              <Avatar 
                size={40} 
                icon={<CheckCircleOutlined />} 
                style={{ 
                  background: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
                  marginRight: 16
                }} 
              />
              <div>
                <Title level={4} style={{ margin: 0 }}>问诊配置</Title>
                <Text type="secondary">配置病史陈述者和信息可靠程度</Text>
              </div>
            </div>

            <Row gutter={24}>
              <Col span={8}>
                <Form.Item 
                  name="historian" 
                  label={<Space><TeamOutlined />病史陈述者</Space>}
                >
                  <Select size="large" style={{ borderRadius: 8 }}>
                    <Option value="本人">
                      <Space>
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        本人
                      </Space>
                    </Option>
                    <Option value="家属">
                      <Space>
                        <TeamOutlined style={{ color: '#1890ff' }} />
                        家属
                      </Space>
                    </Option>
                    <Option value="同事/朋友">
                      <Space>
                        <TeamOutlined style={{ color: '#faad14' }} />
                        同事/朋友
                      </Space>
                    </Option>
                    <Option value="其他">
                      <Space>
                        <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                        其他
                      </Space>
                    </Option>
                  </Select>
                </Form.Item>
              </Col>

              {historian !== '本人' && (
                <Col span={8}>
                  <Form.Item 
                    name="historianRelationship" 
                    label={<Space><TeamOutlined />与患者关系</Space>}
                    rules={[{ required: true, message: '请填写与患者关系' }]}
                  >
                    <Input placeholder="如：父子、夫妻" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
              )}

              <Col span={historian === '本人' ? 16 : 8}>
                <Form.Item name="reliability" label={<Space><CheckCircleOutlined />可靠程度</Space>}>
                  <Select size="large" style={{ borderRadius: 8 }}>
                    <Option value="可靠">
                      <Badge color="green" text="可靠" />
                    </Option>
                    <Option value="基本可靠">
                      <Badge color="blue" text="基本可靠" />
                    </Option>
                    <Option value="供参考">
                      <Badge color="orange" text="供参考" />
                    </Option>
                    <Option value="不可靠">
                      <Badge color="red" text="不可靠" />
                    </Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* 数据同步说明 */}
            <div style={{ 
              marginTop: 24, 
              padding: 16, 
              background: '#f6ffed', 
              border: '1px solid #b7eb8f',
              borderRadius: 8
            }}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                <div>
                  <Text strong style={{ color: '#52c41a' }}>数据同步说明</Text>
                  <div style={{ color: '#595959', fontSize: 14, marginTop: 4 }}>
                    提交后，患者信息将自动同步到问诊系统的"一般项目"模块，无需重复录入
                  </div>
                </div>
              </Space>
            </div>

            <div style={{ textAlign: 'center', marginTop: 32, display: 'flex', justifyContent: 'center', gap: 16 }}>
              <Button 
                size="large"
                onClick={() => setCurrentStep(1)}
                style={{ borderRadius: 8 }}
              >
                上一步
              </Button>
              <Button 
                size="large"
                icon={<SaveOutlined />}
                onClick={handleSaveDraft}
                style={{ borderRadius: 8 }}
              >
                保存草稿
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={loading}
                size="large"
                icon={loading ? <LoadingOutlined /> : <CheckCircleOutlined />}
                style={{ 
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
                  border: 'none',
                  padding: '0 48px'
                }}
              >
                {loading ? '创建中...' : '开始问诊'}
              </Button>
            </div>
          </Card>
        </Form>
      </div>
    </div>
  );
};

export default NewInterview;
