import React, { useState, useMemo } from 'react';
import { Layout, Menu, Breadcrumb, Typography, Card, Input, Tag, Tabs, Row, Col, Empty } from 'antd';
import { 
  ReadOutlined, 
  MedicineBoxOutlined, 
  ExperimentOutlined, 
  BookOutlined,
  ShareAltOutlined 
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import KnowledgeGraph from '../../components/KnowledgeGraph';
import './index.css';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;

// Mock Data for 3-Level Navigation
const menuItems = [
  {
    key: 'symptoms',
    icon: <MedicineBoxOutlined />,
    label: '常见症状',
    children: [
      { 
        key: 'respiratory', 
        label: '呼吸系统', 
        children: [
          { key: 'cough', label: '咳嗽' },
          { key: 'dyspnea', label: '呼吸困难' },
          { key: 'hemoptysis', label: '咯血' }
        ] 
      },
      { 
        key: 'digestive', 
        label: '消化系统', 
        children: [
          { key: 'abdominal_pain', label: '腹痛' },
          { key: 'nausea', label: '恶心与呕吐' },
          { key: 'diarrhea', label: '腹泻' }
        ] 
      },
      {
        key: 'general',
        label: '全身症状',
        children: [
          { key: 'fever', label: '发热' },
          { key: 'fatigue', label: '乏力' }
        ]
      }
    ]
  },
  {
    key: 'skills',
    icon: <ExperimentOutlined />,
    label: '问诊技巧',
    children: [
      { key: 'basic', label: '基本原则', children: [{ key: 'communication', label: '沟通技巧' }] },
      { key: 'special', label: '特殊人群', children: [{ key: 'elderly', label: '老年人问诊' }, { key: 'children', label: '儿童问诊' }] }
    ]
  }
];

// Mock Knowledge Data
interface GraphData {
  nodes: { id: string; name: string; category: number; symbolSize?: number }[];
  links: { source: string; target: string; value?: string }[];
  categories: { name: string }[];
}
interface KnowledgeEntry {
  title: string;
  tags: string[];
  content: string;
  graph: GraphData;
}
const knowledgeData: Record<string, KnowledgeEntry> = {
  'cough': {
    title: '咳嗽 (Cough)',
    tags: ['呼吸系统', '常见症状'],
    content: `
## 定义
咳嗽是机体的一种保护性反射动作，通过咳嗽可清除呼吸道内的分泌物或异物。

## 问诊要点 (OPQRST)
- **Onset (起病)**: 急性还是慢性？突发还是渐进？
- **Provocative/Palliative (诱因/缓解)**: 冷空气、运动、体位变化？
- **Quality (性质)**: 干咳？湿咳？金属音？
- **Radiation (放射)**: 无。
- **Severity (程度)**: 影响睡眠？
- **Timing (时间)**: 晨起？夜间？季节性？

## 伴随症状
- **发热**: 提示感染（肺炎、支气管炎）。
- **胸痛**: 胸膜炎、气胸。
- **咯血**: 肺结核、肺癌、支气管扩张。
- **呼吸困难**: 哮喘、COPD、心力衰竭。

## 鉴别诊断
1. **急性支气管炎**: 咳痰，低热，肺部干湿啰音。
2. **肺炎**: 高热，寒战，胸痛，肺实变体征。
3. **肺结核**: 低热，盗汗，消瘦，咯血。
4. **支气管哮喘**: 发作性喘息，呼气性呼吸困难。
    `,
    graph: {
      nodes: [
        { id: '1', name: '咳嗽', category: 0, symbolSize: 50 },
        { id: '2', name: '发热', category: 1, symbolSize: 30 },
        { id: '3', name: '胸痛', category: 1, symbolSize: 30 },
        { id: '4', name: '呼吸困难', category: 1, symbolSize: 30 },
        { id: '5', name: '肺炎', category: 2, symbolSize: 40 },
        { id: '6', name: '肺结核', category: 2, symbolSize: 40 },
        { id: '7', name: '哮喘', category: 2, symbolSize: 40 }
      ],
      links: [
        { source: '1', target: '2', value: '伴随' },
        { source: '1', target: '3', value: '伴随' },
        { source: '1', target: '4', value: '伴随' },
        { source: '1', target: '5', value: '可能导致' },
        { source: '1', target: '6', value: '可能导致' },
        { source: '1', target: '7', value: '可能导致' }
      ],
      categories: [{ name: '症状' }, { name: '伴随症状' }, { name: '疾病' }]
    }
  },
  'fever': {
    title: '发热 (Fever)',
    tags: ['全身症状', '常见症状'],
    content: `
## 定义
体温调节中枢受致热原作用，或体温调节功能障碍，使体温超出正常范围。

## 问诊要点
- **程度**: 低热(37.3-38)、中等(38.1-39)、高热(39.1-41)、超高热(>41)。
- **热型**: 稽留热、弛张热、间歇热、波状热、回归热。
- **伴随症状**: 寒战、皮疹、淋巴结肿大、昏迷。

## 常见病因
1. **感染性**: 细菌、病毒、支原体等。
2. **非感染性**: 血液病、风湿病、恶性肿瘤、中暑。
    `,
    graph: {
      nodes: [
        { id: '1', name: '发热', category: 0, symbolSize: 50 },
        { id: '2', name: '寒战', category: 1, symbolSize: 30 },
        { id: '3', name: '皮疹', category: 1, symbolSize: 30 },
        { id: '4', name: '感染', category: 2, symbolSize: 40 },
        { id: '5', name: '肿瘤', category: 2, symbolSize: 40 }
      ],
      links: [
        { source: '1', target: '2', value: '伴随' },
        { source: '1', target: '3', value: '伴随' },
        { source: '1', target: '4', value: '病因' },
        { source: '1', target: '5', value: '病因' }
      ],
      categories: [{ name: '症状' }, { name: '伴随症状' }, { name: '病因' }]
    }
  }
};

const Knowledge: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState('cough');

  const currentData = useMemo(() => knowledgeData[selectedKey], [selectedKey]);

  const onMenuSelect = ({ key }: { key: string }) => {
    if (knowledgeData[key]) {
      setSelectedKey(key);
    }
  };

  const handleNodeClick = (node: { id: string; name: string; category: number; symbolSize?: number }) => {
    console.log('Clicked node:', node);
    // Future: Navigate to clicked node if it exists in knowledge base
  };

  return (
    <Layout className="knowledge-page msia-page" style={{ height: 'calc(100vh - 64px)' }}>
      <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0', overflowY: 'auto' }}>
        <div style={{ padding: 16 }}>
          <Search placeholder="搜索知识库..." onSearch={(value) => {
            const key = Object.keys(knowledgeData).find(k => (knowledgeData[k].title + knowledgeData[k].tags.join(',')).includes(value));
            if (key) setSelectedKey(key);
          }} />
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={['cough']}
          defaultOpenKeys={['symptoms', 'respiratory']}
          style={{ borderRight: 0 }}
          items={menuItems}
          onSelect={onMenuSelect}
        />
      </Sider>
      
      <Layout style={{ padding: '0 24px 24px' }}>
        <Breadcrumb style={{ margin: '16px 0' }} items={[
            { title: <ReadOutlined /> },
            { title: '知识库' },
            { title: currentData?.title || '详情' }
        ]} />
        
        <Content
          style={{
            background: '#fff',
            padding: 24,
            margin: 0,
            minHeight: 280,
            overflowY: 'auto',
            borderRadius: 8
          }}
        >
          {currentData ? (
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                <div style={{ marginBottom: 24 }}>
                   <Title level={2}>{currentData.title}</Title>
                   <Space size={[0, 8]} wrap>
                     {currentData.tags.map((tag: string) => (
                       <Tag key={tag} color="blue">{tag}</Tag>
                     ))}
                   </Space>
                </div>
                
                <Tabs defaultActiveKey="content">
                  <Tabs.TabPane tab={<span><BookOutlined /> 知识详情</span>} key="content">
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {currentData.content}
                      </ReactMarkdown>
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane tab={<span><ShareAltOutlined /> 知识图谱</span>} key="graph">
                    <KnowledgeGraph 
                      data={currentData.graph} 
                      height={500} 
                      onNodeClick={handleNodeClick}
                    />
                  </Tabs.TabPane>
                </Tabs>
              </Col>
              
              <Col xs={24} lg={8}>
                <Card title="相关推荐" size="small" style={{ marginBottom: 16 }}>
                   <p><a onClick={() => setSelectedKey('fever')}>发热的鉴别诊断</a></p>
                   <p><a>呼吸困难的急救处理</a></p>
                   <p><a>胸痛的危急值识别</a></p>
                </Card>
                <Card title="最近更新" size="small">
                   <Text type="secondary" style={{ fontSize: 12 }}>2025-02-06 更新了高血压诊疗指南</Text>
                </Card>
              </Col>
            </Row>
          ) : (
             <Empty description="请选择左侧菜单查看详情" />
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default Knowledge;
