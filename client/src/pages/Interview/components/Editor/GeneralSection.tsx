import React, { useEffect, useMemo } from 'react';
import { Form, Input, Row, Col, Typography, Select, Card, InputNumber, Space, Grid, theme } from 'antd';
import LazyDatePicker from '../../../../components/lazy/LazyDatePicker';
import dayjs from 'dayjs';
import AgeDisplayView from './AgeDisplay';
import { computeAgeDisplay, formatAgeText, normalizeAge } from '../../../../utils/age';
import HukouSelect from '../../../../components/HukouSelect';
import BirthplaceSelect from '../../../../components/BirthplaceSelect';

const { Title } = Typography;
const { useBreakpoint } = Grid;

const GeneralSection: React.FC = () => {
  const { token } = theme.useToken();
  const form = Form.useFormInstance();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const birthDate = Form.useWatch('birthDate', form);
  const recordTime = Form.useWatch(['generalInfo', 'recordTime'], form);
  const historian = Form.useWatch('historian', form);
  const ageYears = Form.useWatch('ageYears', form) as number | undefined;
  const ageMonthsPart = Form.useWatch('ageMonthsPart', form) as number | undefined;
  
  // 监听需要双向同步的字段
  const generalOccupation = Form.useWatch('occupation', form);
  const generalEmployer = Form.useWatch('employer', form);
  const generalPlaceOfBirth = Form.useWatch('placeOfBirth', form);
  const generalMaritalStatus = Form.useWatch(['maritalHistory', 'status'], form);

  /**
   * 确保民族字段有默认值（汉族）
   * 当从数据库加载数据时，如果 ethnicity 为 null/undefined，则设置为默认值
   */
  useEffect(() => {
    const currentEthnicity = form.getFieldValue('ethnicity');
    if (!currentEthnicity) {
      form.setFieldValue('ethnicity', '汉族');
    }
  }, [form]);

  /**
   * 自动计算并写回表单字段，避免重复写入导致受控组件循环更新
   */
  useEffect(() => {
    const ref = recordTime ?? dayjs();
    const display = computeAgeDisplay(birthDate, ref);
    if (!display) return;
    const patch: Record<string, unknown> = {};

    if (form.getFieldValue('age') !== display.yearsFloat) patch.age = display.yearsFloat;
    if ((form.getFieldValue('ageYears') as unknown) !== display.yearsPart) patch.ageYears = display.yearsPart;
    if ((form.getFieldValue('ageMonthsTotal') as unknown) !== display.totalMonthsInt) patch.ageMonthsTotal = display.totalMonthsInt;
    if ((form.getFieldValue('ageMonthsPart') as unknown) !== display.monthsPart) patch.ageMonthsPart = display.monthsPart;
    if (form.getFieldValue('ageDisplayText') !== display.mainText) patch.ageDisplayText = display.mainText;
    if (form.getFieldValue('ageDisplayBackupText') !== (display.backupText ?? '')) patch.ageDisplayBackupText = display.backupText ?? '';

    if (Object.keys(patch).length > 0) {
      form.setFieldsValue(patch);
    }
  }, [birthDate, recordTime, form]);

  /**
   * 兜底：未填写出生日期时允许手动输入年龄（年/月）
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

    if ((form.getFieldValue('ageYears') as unknown) !== normalized.years) patch.ageYears = normalized.years;
    if ((form.getFieldValue('ageMonthsPart') as unknown) !== normalized.months) patch.ageMonthsPart = normalized.months;
    if ((form.getFieldValue('ageMonthsTotal') as unknown) !== normalized.totalMonths) patch.ageMonthsTotal = normalized.totalMonths;
    if (form.getFieldValue('age') !== yearsFloat) patch.age = yearsFloat;
    if (form.getFieldValue('ageDisplayText') !== nextDisplayText) patch.ageDisplayText = nextDisplayText;
    if (form.getFieldValue('ageDisplayBackupText') !== '') patch.ageDisplayBackupText = '';

    if (Object.keys(patch).length > 0) {
      form.setFieldsValue(patch);
    }
  }, [birthDate, recordTime, ageYears, ageMonthsPart, form]);

  const ageDisplay = useMemo(() => {
    return computeAgeDisplay(birthDate, recordTime ?? dayjs()) ?? undefined;
  }, [birthDate, recordTime]);

  /**
   * 当陈述者为本人时，清空关系字段（仅在值不同时执行）
   */
  useEffect(() => {
      if (historian === '本人') {
          const prev = form.getFieldValue('historianRelationship');
          if (prev !== undefined) {
            form.setFieldValue('historianRelationship', undefined);
          }
      }
  }, [historian, form]);

  /**
   * 双向同步：职业（一般项 -> 个人史）
   */
  useEffect(() => {
    const personalOccupation = form.getFieldValue(['personalHistory', 'occupation']);
    if (generalOccupation && generalOccupation !== personalOccupation) {
      form.setFieldValue(['personalHistory', 'occupation'], generalOccupation);
    }
  }, [generalOccupation, form]);

  /**
   * 双向同步：工作单位（一般项 -> 个人史）
   */
  useEffect(() => {
    const personalEmployer = form.getFieldValue(['personalHistory', 'employer']);
    if (generalEmployer && generalEmployer !== personalEmployer) {
      form.setFieldValue(['personalHistory', 'employer'], generalEmployer);
    }
  }, [generalEmployer, form]);

  /**
   * 双向同步：出生地（一般项 -> 个人史）
   */
  useEffect(() => {
    const personalBirthplace = form.getFieldValue(['personalHistory', 'birthplace']);
    if (generalPlaceOfBirth && generalPlaceOfBirth !== personalBirthplace) {
      form.setFieldValue(['personalHistory', 'birthplace'], generalPlaceOfBirth);
    }
  }, [generalPlaceOfBirth, form]);

  /**
   * 双向同步：婚姻状况（一般项 -> 婚育史）
   */
  useEffect(() => {
    const maritalStatus = form.getFieldValue(['maritalHistory', 'status']);
    // 避免循环更新，只在值确实不同时才设置
    if (generalMaritalStatus && generalMaritalStatus !== maritalStatus) {
      // 注意：这里不需要额外设置，因为字段路径相同，Form会自动同步
    }
  }, [generalMaritalStatus, form]);

  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: isMobile ? 14 : 24 }}>一般项目 (General Information)</Title>
      
      {/* 1. 基本信息 */}
      <Card type="inner" title="【基本信息】" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={12} md={6}>
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="输入患者姓名" />
            </Form.Item>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Form.Item name="gender" label="性别" rules={[{ required: true, message: '请选择性别' }]}>
               <Select placeholder="选择性别">
                   <Select.Option value="男">男</Select.Option>
                   <Select.Option value="女">女</Select.Option>
                   <Select.Option value="其他">其他</Select.Option>
               </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
             <Form.Item
               label="年龄"
               help={isMobile ? null : (
                 ageDisplay?.backupText
                   ? `出生日期填写后会按年龄段策略自动换算；备用：${ageDisplay.backupText}`
                   : '出生日期填写后会按年龄段策略自动换算'
               )}
               required
             >
               {ageDisplay ? (
                 <div style={{ width: '100%', minHeight: 32, display: 'flex', alignItems: 'center', background: token.colorBgContainer, border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadius, padding: '0 11px' }}>
                   <AgeDisplayView display={ageDisplay} />
                 </div>
               ) : (
                 <Space.Compact style={{ width: '100%' }}>
                   <Form.Item
                     name="ageYears"
                     noStyle
                     rules={[
                       { required: true, message: '请输入年龄（年）' },
                       {
                         validator: (_rule, value) => {
                           if (value === null || value === undefined || value === '') return Promise.resolve();
                           const n = typeof value === 'number' ? value : Number(String(value));
                           if (Number.isFinite(n) && n >= 0 && n <= 150) return Promise.resolve();
                           return Promise.reject(new Error('请输入有效年龄（年）'));
                         }
                       }
                     ]}
                   >
                     <InputNumber<number>
                       style={{ width: '60%', background: token.colorBgContainer }}
                       placeholder="年"
                       min={0}
                       max={150}
                       suffix="岁"
                     />
                   </Form.Item>
                   <Form.Item
                     name="ageMonthsPart"
                     noStyle
                     rules={[
                       {
                         validator: (_rule, value) => {
                           if (value === null || value === undefined || value === '') return Promise.resolve();
                           const n = typeof value === 'number' ? value : Number(String(value));
                           if (Number.isFinite(n) && n >= 0 && n <= 1200) return Promise.resolve();
                           return Promise.reject(new Error('请输入有效年龄（月）'));
                         }
                       }
                     ]}
                   >
                     <InputNumber<number>
                       style={{ width: '40%', background: token.colorBgContainer }}
                       placeholder="月"
                       min={0}
                       max={1200}
                       suffix="月"
                     />
                   </Form.Item>
                 </Space.Compact>
               )}
               <Form.Item
                 name="age"
                 hidden
                 rules={[
                   {
                     validator: (_rule, value) => {
                       const birth = form.getFieldValue('birthDate');
                       const years = form.getFieldValue('ageYears');
                       const months = form.getFieldValue('ageMonthsPart');
                       const hasBirth = Boolean(birth);
                       const hasManualYears = years !== null && years !== undefined && years !== '';
                       const hasManual = hasManualYears || (months !== null && months !== undefined && months !== '');
                       if (!hasBirth && !hasManual) {
                         return Promise.reject(new Error('请填写出生日期或年龄'));
                       }
                       if (value === null || value === undefined || value === '') {
                         return Promise.reject(new Error('年龄换算失败，请检查输入'));
                       }
                       const n = typeof value === 'number' ? value : Number(String(value));
                       if (Number.isFinite(n) && n >= 0 && n <= 150) return Promise.resolve();
                       return Promise.reject(new Error('年龄数值异常'));
                     }
                   }
                 ]}
               >
                 <Input />
               </Form.Item>
               <Form.Item name="ageDisplayText" hidden>
                 <Input />
               </Form.Item>
               <Form.Item name="ageDisplayBackupText" hidden>
                 <Input />
               </Form.Item>
             </Form.Item>
          </Col>
          <Col xs={12} sm={12} md={6}>
              <Form.Item 
                name="ethnicity" 
                label="民族" 
                initialValue="汉族" 
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
          <Col xs={12} sm={12} md={6}>
              <Form.Item
                name={['maritalHistory', 'status']}
                label="婚姻状况"
                rules={[{ required: true, message: '请选择婚姻状况' }]}
              >
                  <Select placeholder="选择婚姻状况">
                      <Select.Option value="未婚">未婚</Select.Option>
                      <Select.Option value="已婚">已婚</Select.Option>
                      <Select.Option value="离异">离异</Select.Option>
                      <Select.Option value="丧偶">丧偶</Select.Option>
                  </Select>
              </Form.Item>
          </Col>
          <Col xs={12} sm={12} md={6}>
              <Form.Item name="nativePlace" label="籍贯">
                  <HukouSelect placeholder="选择籍贯（到市级）" />
              </Form.Item>
          </Col>
          <Col xs={12} sm={12} md={6}>
              <Form.Item name="placeOfBirth" label="出生地">
                  <BirthplaceSelect placeholder="选择出生地（到区县级）" />
              </Form.Item>
          </Col>
          <Col xs={12} sm={12} md={6}>
               <Form.Item name="occupation" label="职业">
                  <Input placeholder="职业" />
               </Form.Item>
          </Col>
          <Col xs={12} sm={12} md={6}>
             <Form.Item name="birthDate" label="出生日期">
                <LazyDatePicker
                  style={{ width: '100%' }}
                  placeholder="选择日期"
                  placement="bottomLeft"
                  classNames={{ popup: { root: isMobile ? 'msia-mobile-picker' : undefined } }}
                  getPopupContainer={(trigger: HTMLElement) => (isMobile ? document.body : trigger.parentElement ?? document.body)}
                />
             </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* 2. 记录信息 */}
      <Card type="inner" title="【记录信息】" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
              <Form.Item name={['generalInfo', 'admissionTime']} label="入院时间">
                  <LazyDatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: '100%' }}
                    placeholder="请选择入院时间"
                    placement="bottomLeft"
                    classNames={{ popup: { root: isMobile ? 'msia-mobile-picker' : undefined } }}
                    getPopupContainer={(trigger: HTMLElement) => (isMobile ? document.body : trigger.parentElement ?? document.body)}
                  />
              </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
              <Form.Item
                name={['generalInfo', 'recordTime']}
                label="记录时间"
                initialValue={dayjs()}
                rules={[{ required: true, message: '请选择记录时间' }]}
              >
                  <LazyDatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: '100%' }}
                    placeholder="请选择记录时间"
                    placement="bottomLeft"
                    classNames={{ popup: { root: isMobile ? 'msia-mobile-picker' : undefined } }}
                    getPopupContainer={(trigger: HTMLElement) => (isMobile ? document.body : trigger.parentElement ?? document.body)}
                  />
              </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
             {/* 占位 */}
          </Col>
          <Col xs={12} sm={12} md={8}>
              <Form.Item
                name="historian"
                label="病史陈述者"
                initialValue="本人"
                tooltip={isMobile ? undefined : '非患者本人时需注明与患者关系及可靠程度'}
              >
                   <Select>
                        <Select.Option value="本人">本人</Select.Option>
                        <Select.Option value="家属">家属</Select.Option>
                        <Select.Option value="同事/朋友">同事/朋友</Select.Option>
                        <Select.Option value="其他">其他</Select.Option>
                    </Select>
              </Form.Item>
          </Col>
          <Col xs={12} sm={12} md={8}>
            {historian !== '本人' && (
              <Form.Item name="historianRelationship" label="与患者关系">
                   <Input placeholder="如：父子、夫妻" />
              </Form.Item>
            )}
          </Col>
          <Col xs={12} sm={12} md={8}>
              <Form.Item name="reliability" label="可靠程度" initialValue="可靠">
                  <Select placeholder="选择可靠程度">
                      <Select.Option value="可靠">可靠</Select.Option>
                      <Select.Option value="基本可靠">基本可靠</Select.Option>
                      <Select.Option value="供参考">供参考</Select.Option>
                      <Select.Option value="不可评估">不可评估</Select.Option>
                  </Select>
              </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* 3. 联系信息 */}
      <Card type="inner" title="【联系信息】" size="small">
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
               <Form.Item
                 name="phone"
                 label="联系电话"
                 rules={[
                   { required: true, message: '请输入联系电话' },
                   { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
                 ]}
               >
                   <Input placeholder="11位手机号" />
               </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
               <Form.Item name="employer" label="工作单位">
                   <Input placeholder="输入工作单位名称" />
               </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
               <Form.Item name="address" label="联系地址">
                   <Input placeholder="输入详细居住地址" />
               </Form.Item>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default GeneralSection;
