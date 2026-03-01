import React, { useState, useEffect, useCallback } from 'react';
import { 
  App as AntdApp, 
  Button, 
  Form, 
  Input, 
  Select, 
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
  Alert,
  Grid,
  theme
} from 'antd';
import logger from '../../utils/logger';
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
import LazyDatePicker from '../../components/lazy/LazyDatePicker';
import api, { unwrapData } from '../../utils/api';
import { computeAgeDisplay, formatAgeText, normalizeAge } from '../../utils/age';
import AgeDisplayView from './components/Editor/AgeDisplay';
import HukouSelect from '../../components/HukouSelect';
import BirthplaceSelect from '../../components/BirthplaceSelect';
import './NewInterview.css';

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
  const { token } = theme.useToken();
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
        
        
        const sessionRes = await api.post('/sessions', {
          patientId: patientId,
          ...sessionData,
          // 确保数据同步标记
          syncVersion: Date.now()
        }) as unknown as import('../../utils/api').ApiResponse<{ id: string }>;

        const sessionResult = unwrapData<{ id: string }>(sessionRes);
        if (sessionResult) {
          
          setSyncStatus('synced');
          message.success('患者档案创建成功，数据已同步到问诊系统');
          navigate(`/interview/${sessionResult.id}`);
          return;
        } else {
          throw new Error('会话创建失败');
        }
      } catch (err) {
        logger.error('[NewInterview] 创建会话失败:', err);
        // 回滚患者记录
        try {
          await api.delete(`/patients/${patientId}`) as unknown as import('../../utils/api').ApiResponse;
          message.error('会话创建失败，已回滚患者记录');
        } catch (rollbackErr) {
          logger.error('[NewInterview] 患者回滚失败', rollbackErr);
          message.error('会话创建失败，患者回滚失败，请手动处理');
        }
        setSyncStatus('error');
      }
    } catch (error) {
      logger.error('[NewInterview] 创建失败:', error);
      message.error('创建失败，请检查网络连接后重试');
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 暂存草稿
   * 使用 sessionStorage 存储，关闭浏览器后自动清除，提高安全性
   */
  const handleSaveDraft = useCallback(async () => {
    const values = form.getFieldsValue();
    if (!values.name) {
      message.warning('至少需要填写姓名才能保存草稿');
      return;
    }
    
    try {
      sessionStorage.setItem('interview_draft', JSON.stringify(values));
      message.success('草稿已保存到本地');
    } catch {
      message.error('保存草稿失败');
    }
  }, [form, message]);

  /**
   * 加载草稿
   * 从 sessionStorage 读取，关闭浏览器后自动清除
   */
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem('interview_draft');
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
      logger.error('[NewInterview] 加载草稿失败', e);
    }
  }, [form, message]);

  /**
   * handleStepChange
   * 步骤切换前验证当前步骤的必填项，而不是目标步骤的字段
   * 修复点击“下一步”时提示下一步未填的误判问题
   */
  const handleStepChange = async (nextStep: number) => {
    const getRequiredFieldsByStep = (s: number): string[] => {
      if (s === 0) return ['name', 'gender', 'ethnicity', 'maritalStatus'];
      if (s === 1) return ['phone', 'recordTime'];
      return [];
    };
    const requiredNow = getRequiredFieldsByStep(currentStep);
    if (requiredNow.length > 0) {
      try {
        
        await form.validateFields(requiredNow);
      } catch {
        logger.warn('[NewInterview] 当前步骤未完成，阻止切换', { currentStep, requiredNow });
        message.warning('请完成当前步骤的必填项');
        return;
      }
    }
    
    setCurrentStep(nextStep);
  };

  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  return (
    <div className="new-interview-page">
      {/* 页面头部 */}
      <div className="page-header">
        <div style={{ 
          position: isMobile ? 'relative' : 'absolute', 
          left: 0, 
          top: 0, 
          alignSelf: isMobile ? 'flex-start' : 'auto',
          marginBottom: isMobile ? 16 : 0
        }}>
          <Button 
            type="text" 
            icon={<ArrowRightOutlined rotate={180} />} 
            onClick={() => navigate('/interview')}
            className="back-btn"
          >
            {isMobile ? '返回列表' : '返回问诊列表'}
          </Button>
        </div>

        <div className="header-avatar">
          <Avatar 
            size={80} 
            icon={<MedicineBoxOutlined />} 
          />
        </div>
        <Title level={2} className="page-title">
          开始新问诊
        </Title>
        <Text type="secondary" className="page-subtitle">
          建立患者档案，数据将自动同步到问诊系统
        </Text>
      </div>

      {/* 步骤条 */}
      <div className="steps-container">
        {isMobile ? (
          <div className="mobile-steps">
            <Button
              type="text"
              onClick={() => handleStepChange(0)}
              className={currentStep === 0 ? 'active' : ''}
              icon={<UserOutlined style={{ fontSize: 20, color: currentStep === 0 ? '#fff' : token.colorTextQuaternary }} />}
            />
            <Button
              type="text"
              onClick={() => handleStepChange(1)}
              className={currentStep === 1 ? 'active' : ''}
              icon={<PhoneOutlined style={{ fontSize: 20, color: currentStep === 1 ? '#fff' : token.colorTextQuaternary }} />}
            />
            <Button
              type="text"
              onClick={() => handleStepChange(2)}
              className={currentStep === 2 ? 'active' : ''}
              icon={<CheckCircleOutlined style={{ fontSize: 20, color: currentStep === 2 ? '#fff' : token.colorTextQuaternary }} />}
            />
          </div>
        ) : (
          <Steps 
            current={currentStep} 
            onChange={handleStepChange}
            orientation="horizontal"
            titlePlacement="horizontal"
            size="default"
            items={formSteps.map(step => ({
              title: step.title,
              icon: step.icon,
            }))}
          />
        )}
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
      <div className="form-container">
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
            style={{ display: currentStep === 0 ? 'block' : 'none' }}
          >
            <div className="card-header">
              <Avatar 
                size={48} 
                icon={<UserOutlined />} 
              />
              <div>
                <Title level={4} className="card-header-title">患者身份信息</Title>
                <Text type="secondary" className="card-header-desc">请填写患者的基本身份信息，与问诊系统保持一致</Text>
              </div>
            </div>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
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
              <Col xs={12} sm={12} md={8}>
                <Form.Item 
                  name="gender" 
                  label={<Space><TeamOutlined />性别</Space>} 
                  rules={[{ required: true, message: '请选择性别' }]}
                >
                  <Select
                    placeholder="请选择"
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
              <Col xs={12} sm={12} md={8}>
                <Form.Item
                  name="ethnicity"
                  label={<Space><TeamOutlined />民族</Space>}
                  rules={[
                    { required: true, message: '请选择民族' },
                    {
                      validator: (_, value) => {
                        const validEthnicities = [
                          '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族',
                          '满族', '侗族', '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族',
                          '佤族', '畲族', '高山族', '拉祜族', '水族', '东乡族', '纳西族', '景颇族', '柯尔克孜族', '土族',
                          '达斡尔族', '仫佬族', '羌族', '布朗族', '撒拉族', '毛南族', '仡佬族', '锡伯族', '阿昌族', '普米族',
                          '塔吉克族', '怒族', '乌孜别克族', '俄罗斯族', '鄂温克族', '德昂族', '保安族', '裕固族', '京族', '塔塔尔族',
                          '独龙族', '鄂伦春族', '赫哲族', '门巴族', '珞巴族', '基诺族'
                        ];
                        if (!value || validEthnicities.includes(value)) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('请从列表中选择民族'));
                      }
                    }
                  ]}
                >
                  <Select
                    placeholder="选择民族"
                    showSearch
                    optionFilterProp="children"
                    notFoundContent="无匹配民族"
                    size="large"
                    style={{ borderRadius: 8 }}
                  >
                    <Select.Option value="汉族">汉族</Select.Option>
                    <Select.Option value="蒙古族">蒙古族</Select.Option>
                    <Select.Option value="回族">回族</Select.Option>
                    <Select.Option value="藏族">藏族</Select.Option>
                    <Select.Option value="维吾尔族">维吾尔族</Select.Option>
                    <Select.Option value="苗族">苗族</Select.Option>
                    <Select.Option value="彝族">彝族</Select.Option>
                    <Select.Option value="壮族">壮族</Select.Option>
                    <Select.Option value="布依族">布依族</Select.Option>
                    <Select.Option value="朝鲜族">朝鲜族</Select.Option>
                    <Select.Option value="满族">满族</Select.Option>
                    <Select.Option value="侗族">侗族</Select.Option>
                    <Select.Option value="瑶族">瑶族</Select.Option>
                    <Select.Option value="白族">白族</Select.Option>
                    <Select.Option value="土家族">土家族</Select.Option>
                    <Select.Option value="哈尼族">哈尼族</Select.Option>
                    <Select.Option value="哈萨克族">哈萨克族</Select.Option>
                    <Select.Option value="傣族">傣族</Select.Option>
                    <Select.Option value="黎族">黎族</Select.Option>
                    <Select.Option value="傈僳族">傈僳族</Select.Option>
                    <Select.Option value="佤族">佤族</Select.Option>
                    <Select.Option value="畲族">畲族</Select.Option>
                    <Select.Option value="高山族">高山族</Select.Option>
                    <Select.Option value="拉祜族">拉祜族</Select.Option>
                    <Select.Option value="水族">水族</Select.Option>
                    <Select.Option value="东乡族">东乡族</Select.Option>
                    <Select.Option value="纳西族">纳西族</Select.Option>
                    <Select.Option value="景颇族">景颇族</Select.Option>
                    <Select.Option value="柯尔克孜族">柯尔克孜族</Select.Option>
                    <Select.Option value="土族">土族</Select.Option>
                    <Select.Option value="达斡尔族">达斡尔族</Select.Option>
                    <Select.Option value="仫佬族">仫佬族</Select.Option>
                    <Select.Option value="羌族">羌族</Select.Option>
                    <Select.Option value="布朗族">布朗族</Select.Option>
                    <Select.Option value="撒拉族">撒拉族</Select.Option>
                    <Select.Option value="毛南族">毛南族</Select.Option>
                    <Select.Option value="仡佬族">仡佬族</Select.Option>
                    <Select.Option value="锡伯族">锡伯族</Select.Option>
                    <Select.Option value="阿昌族">阿昌族</Select.Option>
                    <Select.Option value="普米族">普米族</Select.Option>
                    <Select.Option value="塔吉克族">塔吉克族</Select.Option>
                    <Select.Option value="怒族">怒族</Select.Option>
                    <Select.Option value="乌孜别克族">乌孜别克族</Select.Option>
                    <Select.Option value="俄罗斯族">俄罗斯族</Select.Option>
                    <Select.Option value="鄂温克族">鄂温克族</Select.Option>
                    <Select.Option value="德昂族">德昂族</Select.Option>
                    <Select.Option value="保安族">保安族</Select.Option>
                    <Select.Option value="裕固族">裕固族</Select.Option>
                    <Select.Option value="京族">京族</Select.Option>
                    <Select.Option value="塔塔尔族">塔塔尔族</Select.Option>
                    <Select.Option value="独龙族">独龙族</Select.Option>
                    <Select.Option value="鄂伦春族">鄂伦春族</Select.Option>
                    <Select.Option value="赫哲族">赫哲族</Select.Option>
                    <Select.Option value="门巴族">门巴族</Select.Option>
                    <Select.Option value="珞巴族">珞巴族</Select.Option>
                    <Select.Option value="基诺族">基诺族</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="birthDate" label={<Space><CalendarOutlined />出生日期</Space>}>
                  <LazyDatePicker 
                    style={{ width: '100%', borderRadius: 8 }} 
                    size="large"
                    placeholder="选择出生日期"
                  />
                </Form.Item>
              </Col>
              
              <Col xs={24} sm={12} md={8}>
                <Form.Item
                  label={<Space><CalendarOutlined />年龄</Space>}
                  help={ageDisplay?.backupText ? `备用显示：${ageDisplay.backupText}` : '出生日期填写后自动计算'}
                  required
                >
                  {ageDisplay ? (
                    <div style={{ 
                      width: '100%', 
                      minHeight: 40, 
                      display: 'flex', 
                      alignItems: 'center', 
                      background: token.colorSuccessBg, 
                      border: `1px solid ${token.colorSuccessBorder}`, 
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
                          size="large"
                        />
                      </Form.Item>
                      <Form.Item name="ageMonthsPart" noStyle>
                        <InputNumber
                          style={{ width: '40%' }}
                          placeholder="月"
                          min={0}
                          max={11}
                          suffix="月"
                          size="large"
                        />
                      </Form.Item>
                    </Space.Compact>
                  )}
                </Form.Item>
              </Col>
              
              <Col xs={24} sm={12} md={8}>
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
              
              <Col xs={24} sm={12} md={8}>
                <Form.Item 
                  name="nativePlace" 
                  label={<Space><EnvironmentOutlined />籍贯</Space>}
                  rules={[{ required: true, message: '请选择籍贯' }]}
                >
                  <HukouSelect 
                    placeholder="选择籍贯（到市级）" 
                    size="large" 
                    style={{ borderRadius: 8 }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item 
                  name="placeOfBirth" 
                  label={<Space><EnvironmentOutlined />出生地</Space>}
                  rules={[{ required: true, message: '请选择出生地' }]}
                >
                  <BirthplaceSelect 
                    placeholder="选择出生地（到区县级）" 
                    size="large" 
                    style={{ borderRadius: 8 }}
                    label="出生地"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="occupation" label={<Space><IdcardOutlined />职业</Space>}>
                  <Input placeholder="患者职业" size="large" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>

            <div className="form-actions">
              <div></div>
              <Button 
                type="primary" 
                size="large"
                onClick={() => handleStepChange(1)}
              >
                下一步<ArrowRightOutlined />
              </Button>
            </div>
          </Card>

          {/* 步骤2: 联系方式 */}
          <Card 
            style={{ display: currentStep === 1 ? 'block' : 'none' }}
          >
            <div className="card-header">
              <Avatar 
                size={48} 
                icon={<PhoneOutlined />} 
              />
              <div>
                <Title level={4} className="card-header-title">联系方式</Title>
                <Text type="secondary" className="card-header-desc">请填写患者的联系方式和地址信息</Text>
              </div>
            </div>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
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
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="employer" label={<Space><IdcardOutlined />工作单位</Space>}>
                  <Input placeholder="工作单位" size="large" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
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
                  background: token.colorPrimary,
                  marginRight: 12
                }} 
              />
              <Text strong>记录信息</Text>
            </div>
            
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Form.Item name="admissionTime" label="入院时间">
                  <LazyDatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: '100%', borderRadius: 8 }}
                    placeholder="选择入院时间"
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                  <Form.Item 
                  name="recordTime" 
                  label="记录时间"
                  rules={[{ required: true, message: '请选择记录时间' }]}
                >
                  <LazyDatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: '100%', borderRadius: 8 }}
                    placeholder="选择记录时间"
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <div className="form-actions">
              <Button
                size="large"
                onClick={() => setCurrentStep(0)}
              >
                上一步
              </Button>
              <Button
                type="primary"
                size="large"
                onClick={() => handleStepChange(2)}
              >
                下一步<ArrowRightOutlined />
              </Button>
            </div>
          </Card>

          {/* 步骤3: 问诊配置 */}
          <Card 
            style={{ display: currentStep === 2 ? 'block' : 'none' }}
          >
            <div className="card-header">
              <Avatar 
                size={48} 
                icon={<CheckCircleOutlined />} 
              />
              <div>
                <Title level={4} className="card-header-title">问诊配置</Title>
                <Text type="secondary" className="card-header-desc">配置病史陈述者和信息可靠程度</Text>
              </div>
            </div>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
                <Form.Item
                  name="historian"
                  label={<Space><TeamOutlined />病史陈述者</Space>}
                >
                  <Select size="large" style={{ borderRadius: 8 }}>
                    <Option value="本人">
                      <Space>
                        <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                        本人
                      </Space>
                    </Option>
                    <Option value="家属">
                      <Space>
                        <TeamOutlined style={{ color: token.colorPrimary }} />
                        家属
                      </Space>
                    </Option>
                    <Option value="同事/朋友">
                      <Space>
                        <TeamOutlined style={{ color: token.colorWarning }} />
                        同事/朋友
                      </Space>
                    </Option>
                    <Option value="其他">
                      <Space>
                        <InfoCircleOutlined style={{ color: token.colorTextQuaternary }} />
                        其他
                      </Space>
                    </Option>
                  </Select>
                </Form.Item>
              </Col>

              {historian !== '本人' && (
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="historianRelationship"
                    label={<Space><TeamOutlined />与患者关系</Space>}
                    rules={[{ required: true, message: '请填写与患者关系' }]}
                  >
                    <Input placeholder="如：父子、夫妻" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
              )}

              <Col xs={24} sm={12} md={historian === '本人' ? 16 : 8}>
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

            <div className="form-actions">
              <Button
                size="large"
                onClick={() => setCurrentStep(1)}
              >
                上一步
              </Button>
              <div style={{ display: 'flex', gap: 12 }}>
                <Button 
                  size="large"
                  icon={<SaveOutlined />}
                  onClick={handleSaveDraft}
                >
                  保存草稿
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  icon={loading ? <LoadingOutlined /> : <CheckCircleOutlined />}
                >
                  {loading ? '创建中...' : '开始问诊'}
                </Button>
              </div>
            </div>
          </Card>
        </Form>
      </div>
    </div>
  );
};

export default NewInterview;
