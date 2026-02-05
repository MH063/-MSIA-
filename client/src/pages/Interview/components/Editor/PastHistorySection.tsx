import React, { useEffect, useRef } from 'react';
import { Form, Checkbox, Input, Typography, Card, Radio, Space, Button, DatePicker, Select, Grid } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';

const { Title } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

interface PastHistorySectionProps {
  form: FormInstance;
}

const PastHistorySection: React.FC<PastHistorySectionProps> = ({ form }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const EMPTY_SURGERIES = React.useMemo<Record<string, unknown>[]>(() => [], []);
  const EMPTY_TRANSFUSIONS = React.useMemo<Record<string, unknown>[]>(() => [], []);
  const EMPTY_ALLERGIES = React.useMemo<Record<string, unknown>[]>(() => [], []);

  const surgeries = (Form.useWatch(['pastHistory', 'surgeries'], form) as Record<string, unknown>[] | undefined) || EMPTY_SURGERIES;
  const transfusions = (Form.useWatch(['pastHistory', 'transfusions'], form) as Record<string, unknown>[] | undefined) || EMPTY_TRANSFUSIONS;
  const allergies = (Form.useWatch(['pastHistory', 'allergies'], form) as Record<string, unknown>[] | undefined) || EMPTY_ALLERGIES;
  const noSurgeriesTrauma = Form.useWatch(['pastHistory', 'noSurgeriesTrauma'], form);
  const noTransfusions = Form.useWatch(['pastHistory', 'noTransfusions'], form);
  const noAllergies = Form.useWatch(['pastHistory', 'noAllergies'], form);
  
  // 标记用户是否手动修改过病史文本
  const userModifiedIllnessRef = useRef<boolean>(false);

  useEffect(() => {
    const curr = form.getFieldValue(['pastHistory', 'surgeries']);
    if (curr === undefined || curr === null) return;
    if (!Array.isArray(curr)) form.setFieldValue(['pastHistory', 'surgeries'], []);
  }, [form]);

  useEffect(() => {
    const curr = form.getFieldValue(['pastHistory', 'allergies']);
    if (curr === undefined || curr === null) return;
    if (!Array.isArray(curr)) form.setFieldValue(['pastHistory', 'allergies'], []);
  }, [form]);

  useEffect(() => {
    const curr = form.getFieldValue(['pastHistory', 'transfusions']);
    if (curr === undefined || curr === null) return;
    if (!Array.isArray(curr)) form.setFieldValue(['pastHistory', 'transfusions'], []);
  }, [form]);

  // 实时同步结构化数据到 illnessHistory 字符串字段


  useEffect(() => {
    if (Array.isArray(surgeries) && surgeries.length > 0 && noSurgeriesTrauma) {
      form.setFieldValue(['pastHistory', 'noSurgeriesTrauma'], false);
    }
  }, [form, noSurgeriesTrauma, surgeries]);

  useEffect(() => {
    if (!noSurgeriesTrauma) return;
    const curr = form.getFieldValue(['pastHistory', 'surgeries']);
    if (Array.isArray(curr) && curr.length === 0) return;
    form.setFieldValue(['pastHistory', 'surgeries'], []);
  }, [form, noSurgeriesTrauma]);

  useEffect(() => {
    if (Array.isArray(transfusions) && transfusions.length > 0 && noTransfusions) {
      form.setFieldValue(['pastHistory', 'noTransfusions'], false);
    }
  }, [form, noTransfusions, transfusions]);

  useEffect(() => {
    if (!noTransfusions) return;
    const curr = form.getFieldValue(['pastHistory', 'transfusions']);
    if (Array.isArray(curr) && curr.length === 0) return;
    form.setFieldValue(['pastHistory', 'transfusions'], []);
  }, [form, noTransfusions]);

  useEffect(() => {
    if (Array.isArray(allergies) && allergies.length > 0 && noAllergies) {
      form.setFieldValue(['pastHistory', 'noAllergies'], false);
    }
  }, [allergies, form, noAllergies]);

  useEffect(() => {
    if (!noAllergies) return;
    const curr = form.getFieldValue(['pastHistory', 'allergies']);
    if (Array.isArray(curr) && curr.length === 0) return;
    form.setFieldValue(['pastHistory', 'allergies'], []);
  }, [form, noAllergies]);

  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>既往史 (Past History)</Title>
      
      {/* 1. 一般健康状况 */}
      <Card type="inner" title="【既往一般健康状况】" size="small" style={{ marginBottom: 24 }}>
        <Form.Item name={['pastHistory', 'generalHealth']} initialValue="good">
            <Radio.Group>
                <Radio value="good">良好</Radio>
                <Radio value="fair">一般</Radio>
                <Radio value="poor">较差</Radio>
            </Radio.Group>
        </Form.Item>
      </Card>

      {/* 2. 疾病史 */}
      <Card type="inner" title="【疾病史】" size="small" style={{ marginBottom: 24 }}>
         <Form.Item name={['pastHistory', 'pmh_diseases']} label="既往疾病">
            <Input placeholder="请输入既往疾病名称，多个疾病用逗号分隔" />
         </Form.Item>
         <Form.Item name={['pastHistory', 'infectiousHistory']} label="传染病史">
             <Input placeholder="如：肝炎、结核等（无则留空）" />
         </Form.Item>
         <Form.Item name={['pastHistory', 'illnessHistory']} label="疾病史综述">
             <TextArea rows={3} onChange={() => userModifiedIllnessRef.current = true} />
         </Form.Item>
      </Card>

      {/* 3. 手术外伤史 */}
      <Card type="inner" title="【手术外伤史】" size="small" style={{ marginBottom: 24 }}>
         <Form.Item name={['pastHistory', 'noSurgeriesTrauma']} valuePropName="checked">
           <Checkbox>否认手术外伤史</Checkbox>
         </Form.Item>
         <Form.List name={['pastHistory', 'surgeries']}>
           {(fields, { add, remove }) => (
             <>
               {!noSurgeriesTrauma && (
                 <>
                   {fields.map(({ key, name, ...restField }) => (
                     <Space
                       key={key}
                       style={{ display: 'flex', marginBottom: 8, width: '100%' }}
                       align={isMobile ? 'start' : 'baseline'}
                       direction={isMobile ? 'vertical' : 'horizontal'}
                     >
                       <Form.Item
                         {...restField}
                         name={[name, 'date']}
                         style={isMobile ? { marginBottom: 0, width: '100%' } : { marginBottom: 0 }}
                       >
                         <DatePicker
                           placeholder="时间"
                           picker="month"
                           style={isMobile ? { width: '100%' } : undefined}
                           placement="bottomLeft"
                           classNames={{ popup: { root: isMobile ? 'msia-mobile-picker' : undefined } }}
                           getPopupContainer={(trigger) => (isMobile ? document.body : trigger.parentElement ?? document.body)}
                         />
                       </Form.Item>
                       <Form.Item
                         {...restField}
                         name={[name, 'location']}
                         style={isMobile ? { marginBottom: 0, width: '100%' } : { marginBottom: 0 }}
                       >
                         <Input placeholder="地点/医院" style={isMobile ? { width: '100%' } : undefined} />
                       </Form.Item>
                       <Form.Item
                         {...restField}
                         name={[name, 'name']}
                         rules={[{ required: true, message: '请输入手术/外伤名称' }]}
                         style={isMobile ? { marginBottom: 0, width: '100%' } : { marginBottom: 0 }}
                       >
                         <Input placeholder="手术/外伤名称" style={isMobile ? { width: '100%' } : undefined} />
                       </Form.Item>
                       <Form.Item
                         {...restField}
                         name={[name, 'outcome']}
                         style={isMobile ? { marginBottom: 0, width: '100%' } : { marginBottom: 0 }}
                       >
                         <Input placeholder="预后情况" style={isMobile ? { width: '100%' } : undefined} />
                       </Form.Item>
                       <MinusCircleOutlined onClick={() => remove(name)} />
                     </Space>
                   ))}
                   <Form.Item>
                     <Button
                       type="dashed"
                       onClick={() => {
                         const curr = form.getFieldValue(['pastHistory', 'surgeries']);
                         if (!Array.isArray(curr)) form.setFieldValue(['pastHistory', 'surgeries'], []);
                         add();
                       }}
                       block
                       icon={<PlusOutlined />}
                     >
                       添加手术/外伤记录
                     </Button>
                   </Form.Item>
                 </>
               )}
             </>
           )}
         </Form.List>
      </Card>

      {/* 4. 输血史 */}
      <Card type="inner" title="【输血史】" size="small" style={{ marginBottom: 24 }}>
         <Form.Item name={['pastHistory', 'noTransfusions']} valuePropName="checked">
           <Checkbox>否认输血史</Checkbox>
         </Form.Item>
         <Form.List name={['pastHistory', 'transfusions']}>
           {(fields, { add, remove }) => (
             <>
               {!noTransfusions && (
                 <>
                   {fields.map(({ key, name, ...restField }) => (
                     <Space
                       key={key}
                       style={{ display: 'flex', marginBottom: 8, width: '100%' }}
                       align={isMobile ? 'start' : 'baseline'}
                       direction={isMobile ? 'vertical' : 'horizontal'}
                     >
                       <Form.Item
                         {...restField}
                         name={[name, 'date']}
                         style={isMobile ? { marginBottom: 0, width: '100%' } : { marginBottom: 0 }}
                       >
                         <DatePicker
                           placeholder="输血时间"
                           style={isMobile ? { width: '100%' } : undefined}
                           placement="bottomLeft"
                           classNames={{ popup: { root: isMobile ? 'msia-mobile-picker' : undefined } }}
                           getPopupContainer={(trigger) => (isMobile ? document.body : trigger.parentElement ?? document.body)}
                         />
                       </Form.Item>
                       <Form.Item
                         {...restField}
                         name={[name, 'reason']}
                         style={isMobile ? { marginBottom: 0, width: '100%' } : { marginBottom: 0 }}
                       >
                         <Input placeholder="原因" style={isMobile ? { width: '100%' } : undefined} />
                       </Form.Item>
                       <Form.Item
                         {...restField}
                         name={[name, 'amount']}
                         style={isMobile ? { marginBottom: 0, width: '100%' } : { marginBottom: 0 }}
                       >
                         <Input placeholder="量/成分" style={isMobile ? { width: '100%' } : undefined} />
                       </Form.Item>
                       <Form.Item
                         {...restField}
                         name={[name, 'reaction']}
                         style={isMobile ? { marginBottom: 0, width: '100%' } : { marginBottom: 0 }}
                       >
                         <Input placeholder="不良反应" style={isMobile ? { width: '100%' } : undefined} />
                       </Form.Item>
                       <MinusCircleOutlined onClick={() => remove(name)} />
                     </Space>
                   ))}
                   <Form.Item>
                     <Button
                       type="dashed"
                       onClick={() => {
                         const curr = form.getFieldValue(['pastHistory', 'transfusions']);
                         if (!Array.isArray(curr)) form.setFieldValue(['pastHistory', 'transfusions'], []);
                         add();
                       }}
                       block
                       icon={<PlusOutlined />}
                     >
                       添加输血记录
                     </Button>
                   </Form.Item>
                 </>
               )}
             </>
           )}
         </Form.List>
      </Card>

      {/* 5. 过敏史 */}
      <Card type="inner" title="【过敏史】" size="small" style={{ marginBottom: 24 }}>
        <Form.Item name={['pastHistory', 'noAllergies']} valuePropName="checked">
          <Checkbox>否认过敏史</Checkbox>
        </Form.Item>
        <Form.List name={['pastHistory', 'allergies']}>
           {(fields, { add, remove }) => (
             <>
               {!noAllergies && (
                 <>
                   {fields.map(({ key, name, ...restField }) => (
                     <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                       <Form.Item
                         {...restField}
                         name={[name, 'allergen']}
                         label="过敏原"
                         rules={[{ required: true, message: '请输入过敏原' }]}
                       >
                         <Input placeholder="药物/食物名称" />
                       </Form.Item>
                       <Form.Item
                         {...restField}
                         name={[name, 'reaction']}
                         label="反应"
                       >
                         <Input placeholder="过敏表现" />
                       </Form.Item>
                       <Form.Item
                         {...restField}
                         name={[name, 'severity']}
                         label="严重程度"
                       >
                          <Select placeholder="程度" style={{ width: 80 }}>
                            <Select.Option value="mild">轻度</Select.Option>
                            <Select.Option value="moderate">中度</Select.Option>
                            <Select.Option value="severe">重度</Select.Option>
                          </Select>
                       </Form.Item>
                       <MinusCircleOutlined onClick={() => remove(name)} />
                     </Space>
                   ))}
                   <Form.Item>
                     <Button
                       type="dashed"
                       onClick={() => {
                         const curr = form.getFieldValue(['pastHistory', 'allergies']);
                         if (!Array.isArray(curr)) form.setFieldValue(['pastHistory', 'allergies'], []);
                         add();
                       }}
                       block
                       icon={<PlusOutlined />}
                     >
                       添加过敏记录
                     </Button>
                   </Form.Item>
                 </>
               )}
             </>
           )}
         </Form.List>
      </Card>

      {/* 6. 预防接种史 */}
      <Card type="inner" title="【预防接种史】" size="small">
          <Form.Item name={['pastHistory', 'vaccinationHistory']} label="接种情况">
              <TextArea rows={2} placeholder="按计划接种/未接种/特殊接种史" />
          </Form.Item>
      </Card>
    </div>
  );
};

export default PastHistorySection;
