import React, { useEffect, useMemo } from 'react';
import { Form, Input, Checkbox, Typography, Collapse } from 'antd';
import api, { unwrapData } from '../../../../utils/api';
import type { ApiResponse } from '../../../../utils/api';
import { useQuery } from '@tanstack/react-query';

const { Title } = Typography;

/**
 * ReviewOfSystemsSection
 * 系统回顾分节：按系统列出常见症状，支持勾选与详情补充
 */
const systemsConfig = [
  {
    key: 'respiratory',
    label: '1. 呼吸系统',
    symptoms: ['咳嗽', '咳痰', '咯血', '胸痛', '呼吸困难', '哮喘']
  },
  {
    key: 'cardiovascular',
    label: '2. 循环系统',
    symptoms: ['心悸', '胸闷', '胸痛', '水肿', '晕厥', '气短', '夜间阵发性呼吸困难']
  },
  {
    key: 'digestive',
    label: '3. 消化系统',
    symptoms: ['食欲不振', '恶心', '呕吐', '腹痛', '腹胀', '腹泻', '便秘', '呕血', '黑便', '黄疸']
  },
  {
    key: 'urinary',
    label: '4. 泌尿系统',
    symptoms: ['尿频', '尿急', '尿痛', '血尿', '排尿困难', '尿量改变', '颜面水肿', '腰痛']
  },
  {
    key: 'hematologic',
    label: '5. 血液系统',
    symptoms: ['乏力', '头晕', '皮肤出血点', '瘀斑', '牙龈出血', '鼻出血']
  },
  {
    key: 'endocrine',
    label: '6. 内分泌及代谢',
    symptoms: ['多饮', '多食', '多尿', '体重改变', '怕热', '怕冷', '多汗', '乏力', '毛发改变']
  },
  {
    key: 'neurological',
    label: '7. 神经精神',
    symptoms: ['头痛', '头晕', '晕厥', '抽搐', '意识障碍', '失眠', '记忆力下降', '肢体麻木', '瘫痪']
  },
  {
    key: 'musculoskeletal',
    label: '8. 肌肉骨骼',
    symptoms: ['关节痛', '关节肿胀', '关节僵硬', '肌肉痛', '肌肉萎缩', '运动受限']
  }
];

const ReviewOfSystemsSection: React.FC = () => {
  const form = Form.useFormInstance();
  const rosNone = Form.useWatch(['reviewOfSystems', 'none'], form);

  // 监听所有系统的症状和详情字段
  const systemsData = Form.useWatch('reviewOfSystems', form);

  /**
   * 检查是否存在任何症状勾选或详情填写
   */
  const hasAnySymptomsOrDetails = useMemo(() => {
    if (!systemsData || typeof systemsData !== 'object') return false;
    const data = systemsData as Record<string, unknown>;
    
    for (const system of systemsConfig) {
      const systemData = data[system.key] as Record<string, unknown> | undefined;
      if (!systemData) continue;
      
      // 检查是否有症状被勾选
      const symptoms = systemData.symptoms;
      if (Array.isArray(symptoms) && symptoms.length > 0) {
        return true;
      }
      
      // 检查是否有详情填写
      const details = systemData.details;
      if (typeof details === 'string' && details.trim().length > 0) {
        return true;
      }
    }
    return false;
  }, [systemsData]);

  // 监听"无系统回顾异常"勾选状态变化
  useEffect(() => {
    if (!rosNone) return;
    const curr = form.getFieldValue('reviewOfSystems') as Record<string, unknown> | undefined;
    if (!curr || typeof curr !== 'object') return;
    const isOnlyNone = (v: Record<string, unknown>) => Object.keys(v).length === 1 && v.none === true;
    if (isOnlyNone(curr)) return;
    // 清空所有系统数据，只保留 none: true
    form.setFieldValue('reviewOfSystems', { none: true });
  }, [form, rosNone]);

  // 监听症状/详情变化，当存在数据时自动取消"无系统回顾异常"勾选
  useEffect(() => {
    if (hasAnySymptomsOrDetails && rosNone) {
      form.setFieldValue(['reviewOfSystems', 'none'], false);
    }
  }, [form, hasAnySymptomsOrDetails, rosNone]);

  /**
   * 使用后端映射将系统症状的勾选值统一为键（key），显示为中文名称（label）
   * 这样保证表单存储与知识库/接口一致性，同时叙述生成中可通过 key→name 还原中文
   */
  const mappingQuery = useQuery({
    queryKey: ['mapping', 'symptoms'],
    queryFn: async () => {
      const res = await api.get('/mapping/symptoms') as ApiResponse<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>;
      return res;
    }
  });
  const payload = unwrapData<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>(mappingQuery.data as ApiResponse<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>);
  const nameToKey = payload?.nameToKey || {};
  const normalize = (name: string) => {
    const key = nameToKey[name];
    if (key) return { label: name, value: key };
    // 回退：未映射时使用名称的简易key
    return { label: name, value: name.toLowerCase().replace(/\s+/g, '_') };
  };
  const optionsBySystem: Record<string, { label: string; value: string }[]> = (() => {
    const out: Record<string, { label: string; value: string }[]> = {};
    // 只有在成功获取到后端映射数据时才显示症状选项
    if (mappingQuery.data && (mappingQuery.data as ApiResponse<unknown>).success && nameToKey && Object.keys(nameToKey).length > 0) {
      for (const sys of systemsConfig) {
        out[sys.key] = sys.symptoms.map(normalize);
      }
    }
    return out;
  })();

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
          defaultActiveKey={systemsConfig.map(s => s.key)}
          items={systemsConfig.map(system => ({
            key: system.key,
            label: system.label,
            children: (
              <div>
                <Form.Item 
                    name={['reviewOfSystems', system.key, 'symptoms']} 
                    label="常见症状"
                >
                  <Checkbox.Group
                    options={optionsBySystem[system.key] || system.symptoms.map(name => ({ label: name, value: name }))}
                  />
                </Form.Item>
                <Form.Item 
                    name={['reviewOfSystems', system.key, 'details']} 
                    label="详情补充"
                >
                  <Input
                    placeholder="如有其他症状或具体描述，请在此补充"
                  />
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
