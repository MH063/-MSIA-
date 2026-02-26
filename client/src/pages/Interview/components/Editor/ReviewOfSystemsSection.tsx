import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { Form, Input, Checkbox, Typography, Collapse, message } from 'antd';
import {
  ROS_SYSTEMS_CONFIG,
  MAX_DETAILS_LENGTH,
  validateSymptomsArray,
  validateRosData,
  containsMaliciousContent,
  sanitizeInput,
  generateChecksum,
} from '../../../../utils/rosSecurity';

const { Title } = Typography;

 

/**
 * 安全的详情输入组件
 * 带有XSS防护和输入验证
 */
const SecureDetailsInput: React.FC<{
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    if (inputValue.length > MAX_DETAILS_LENGTH) {
      message.warning(`详情长度不能超过${MAX_DETAILS_LENGTH}个字符`);
      return;
    }
    
    if (containsMaliciousContent(inputValue)) {
      message.warning('输入包含不允许的内容，已自动清理');
      const sanitized = sanitizeInput(inputValue);
      onChange?.(sanitized);
      return;
    }
    
    onChange?.(inputValue);
  }, [onChange]);

  return (
    <Input
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={MAX_DETAILS_LENGTH}
      showCount
    />
  );
};

/**
 * 安全的症状复选框组件
 * 带有输入验证
 */
const SecureSymptomCheckbox: React.FC<{
  systemKey: string;
  value?: string[];
  onChange?: (value: string[]) => void;
}> = ({ systemKey, value, onChange }) => {
  const options = useMemo(() => {
    const system = ROS_SYSTEMS_CONFIG.find(s => s.key === systemKey);
    if (!system) return [];
    
    return system.symptoms.map(sym => ({
      label: sym.name,
      value: sym.key
    }));
  }, [systemKey]);

  const handleChange = useCallback((checkedValues: string[]) => {
    const result = validateSymptomsArray(systemKey, checkedValues);
    if (result.validSymptoms) {
      onChange?.(result.validSymptoms);
    }
  }, [systemKey, onChange]);

  return (
    <Checkbox.Group
      options={options}
      value={value}
      onChange={handleChange}
    />
  );
};

/**
 * ReviewOfSystemsSection
 * 系统回顾分节：按系统列出常见症状，支持勾选与详情补充
 * 使用硬编码数据，不依赖数据库
 */
const ReviewOfSystemsSection: React.FC = () => {
  const form = Form.useFormInstance();
  const rosNone = Form.useWatch(['reviewOfSystems', 'none'], form);
  const systemsData = Form.useWatch('reviewOfSystems', form);
  
  const lastRosSymptomsRef = useRef<Set<string>>(new Set());
  const lastChecksumRef = useRef<string>('');

  /**
   * 检查是否存在任何症状勾选或详情填写
   */
  const hasAnySymptomsOrDetails = useMemo(() => {
    if (!systemsData || typeof systemsData !== 'object') return false;
    const data = systemsData as Record<string, unknown>;
    
    for (const system of ROS_SYSTEMS_CONFIG) {
      const systemData = data[system.key] as Record<string, unknown> | undefined;
      if (!systemData) continue;
      
      const symptoms = systemData.symptoms;
      if (Array.isArray(symptoms) && symptoms.length > 0) {
        return true;
      }
      
      const details = systemData.details;
      if (typeof details === 'string' && details.trim().length > 0) {
        return true;
      }
    }
    return false;
  }, [systemsData]);

  /**
   * 收集系统回顾中当前所有已勾选的症状
   */
  const currentRosSymptoms = useMemo(() => {
    const symptoms = new Set<string>();
    if (!systemsData || typeof systemsData !== 'object') return symptoms;
    const data = systemsData as Record<string, unknown>;
    
    for (const system of ROS_SYSTEMS_CONFIG) {
      const systemData = data[system.key] as Record<string, unknown> | undefined;
      if (!systemData) continue;
      
      const systemSymptoms = systemData.symptoms;
      if (Array.isArray(systemSymptoms)) {
        systemSymptoms.forEach((s: string) => symptoms.add(s));
      }
    }
    return symptoms;
  }, [systemsData]);

  /**
   * 反向同步：当系统回顾中取消勾选症状时，同步移除现病史中的对应伴随症状
   */
  useEffect(() => {
    const lastSymptoms = lastRosSymptomsRef.current;
    const currentSymptoms = currentRosSymptoms;
    
    const removedSymptoms: string[] = [];
    lastSymptoms.forEach(symptomKey => {
      if (!currentSymptoms.has(symptomKey)) {
        removedSymptoms.push(symptomKey);
      }
    });
    
    if (removedSymptoms.length > 0) {
      const associatedSymptoms: string[] = form.getFieldValue(['presentIllness', 'associatedSymptoms']) || [];
      const symptomsToRemove = removedSymptoms.filter(s => associatedSymptoms.includes(s));
      
      if (symptomsToRemove.length > 0) {
        const updatedAssociatedSymptoms = associatedSymptoms.filter(s => !symptomsToRemove.includes(s));
        form.setFieldValue(['presentIllness', 'associatedSymptoms'], updatedAssociatedSymptoms);
        console.log('[反向同步] 从现病史伴随症状中移除:', symptomsToRemove);
      }
    }
    
    lastRosSymptomsRef.current = new Set(currentSymptoms);
  }, [currentRosSymptoms, form]);

  /**
   * 数据完整性校验
   */
  useEffect(() => {
    if (!systemsData || typeof systemsData !== 'object') return;
    
    const data = systemsData as Record<string, unknown>;
    const currentChecksum = generateChecksum(data);
    
    if (lastChecksumRef.current && lastChecksumRef.current !== currentChecksum) {
      const validation = validateRosData(data);
      if (!validation.valid) {
        console.warn('[数据完整性] 验证失败:', validation.errors);
      }
    }
    
    lastChecksumRef.current = currentChecksum;
  }, [systemsData]);

  /**
   * 监听"无系统回顾异常"勾选状态变化
   */
  useEffect(() => {
    if (!rosNone) return;
    const curr = form.getFieldValue('reviewOfSystems') as Record<string, unknown> | undefined;
    if (!curr || typeof curr !== 'object') return;
    const isOnlyNone = (v: Record<string, unknown>) => Object.keys(v).length === 1 && v.none === true;
    if (isOnlyNone(curr)) return;
    form.setFieldValue('reviewOfSystems', { none: true });
  }, [form, rosNone]);

  /**
   * 监听症状/详情变化，当存在数据时自动取消"无系统回顾异常"勾选
   */
  useEffect(() => {
    if (hasAnySymptomsOrDetails && rosNone) {
      form.setFieldValue(['reviewOfSystems', 'none'], false);
    }
  }, [form, hasAnySymptomsOrDetails, rosNone]);

  return (
    <div>
      <Title level={5}>系统回顾 (Review of Systems)</Title>
      <Typography.Paragraph type="secondary">
        请询问患者是否有以下系统的相关症状，如有请勾选并补充详情。
      </Typography.Paragraph>

      <Form.Item name={['reviewOfSystems', 'none']} valuePropName="checked">
        <Checkbox disabled={hasAnySymptomsOrDetails}>无系统回顾异常</Checkbox>
      </Form.Item>

      {!rosNone && (
        <Collapse
          defaultActiveKey={ROS_SYSTEMS_CONFIG.map(s => s.key)}
          items={ROS_SYSTEMS_CONFIG.map(system => ({
            key: system.key,
            label: system.label,
            children: (
              <div>
                <Form.Item 
                    name={['reviewOfSystems', system.key, 'symptoms']} 
                    label="常见症状"
                >
                  <SecureSymptomCheckbox systemKey={system.key} />
                </Form.Item>
                <Form.Item 
                    name={['reviewOfSystems', system.key, 'details']} 
                    label="详情补充"
                >
                  <SecureDetailsInput placeholder="如有其他症状或具体描述，请在此补充" />
                </Form.Item>
              </div>
            )
          }))}
        />
      )}
    </div>
  );
};

export default ReviewOfSystemsSection;
