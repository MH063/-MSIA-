import React from 'react';
import { Form, Input, Checkbox, Typography, Collapse } from 'antd';

const { Title } = Typography;

/**
 * ReviewOfSystemsSection
 * 系统回顾分节：按系统列出常见症状，支持勾选与详情补充
 */
const systemsConfig = [
  {
    key: 'respiratory',
    label: '1. 呼吸系统',
    symptoms: ['咳嗽', '咳痰', '咯血', '胸痛', '呼吸困难', '发热', '盗汗']
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
    label: '6. 内分泌及代谢系统',
    symptoms: ['多饮', '多食', '多尿', '体重改变', '怕热', '怕冷', '多汗', '乏力', '毛发改变']
  },
  {
    key: 'neurological',
    label: '7. 神经精神系统',
    symptoms: ['头痛', '头晕', '晕厥', '抽搐', '意识障碍', '失眠', '记忆力下降', '肢体麻木', '瘫痪']
  },
  {
    key: 'musculoskeletal',
    label: '8. 肌肉骨骼系统',
    symptoms: ['关节痛', '关节肿胀', '关节僵硬', '肌肉痛', '肌肉萎缩', '运动受限']
  }
];

const ReviewOfSystemsSection: React.FC = () => {
  return (
    <div>
      <Title level={5}>系统回顾 (Review of Systems)</Title>
      <Typography.Paragraph type="secondary">
        请询问患者是否有以下系统的相关症状，如有请勾选并补充详情。
      </Typography.Paragraph>

      <Collapse
        defaultActiveKey={['respiratory']}
        items={systemsConfig.map(system => ({
          key: system.key,
          label: system.label,
          children: (
            <div>
              <Form.Item 
                  name={['reviewOfSystems', system.key, 'symptoms']} 
                  label="常见症状"
              >
                <Checkbox.Group options={system.symptoms} />
              </Form.Item>
              <Form.Item 
                  name={['reviewOfSystems', system.key, 'details']} 
                  label="详情补充"
              >
                <Input placeholder="如有其他症状或具体描述，请在此补充" />
              </Form.Item>
            </div>
          )
        }))}
      />
    </div>
  );
};

export default ReviewOfSystemsSection;
