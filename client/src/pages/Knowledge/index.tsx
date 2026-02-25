import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Layout, Menu, Breadcrumb, Typography, Card, Input, Tag, Row, Col, Empty, Spin, message } from 'antd';
import { 
  ReadOutlined, 
  MedicineBoxOutlined, 
  ExperimentOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import KnowledgeGraph from '../../components/KnowledgeGraph';
import api, { unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import logger from '../../utils/logger';
import './index.css';

const { Content, Sider } = Layout;
const { Title } = Typography;
const { Search } = Input;

// 知识库条目类型
interface KnowledgeItem {
  id: number;
  symptomKey: string;
  displayName: string;
  category?: string | null;
  description?: string | null;
  redFlags?: string[];
  associatedSymptoms?: string[];
  questions?: string[];
  commonCauses?: string[];
  physicalSigns?: string[];
  bodySystems?: string[];
}

// 图谱数据类型
interface GraphData {
  nodes: { id: string; name: string; category: number; symbolSize?: number }[];
  links: { source: string; target: string; value?: string }[];
  categories: { name: string }[];
}

// 构建图谱数据
function buildGraphData(item: KnowledgeItem): GraphData {
  const nodes: GraphData['nodes'] = [
    { id: 'root', name: item.displayName, category: 0, symbolSize: 50 }
  ];
  const links: GraphData['links'] = [];
  const categories = [
    { name: '核心症状' },
    { name: '红旗征' },
    { name: '伴随症状' },
    { name: '常见病因' }
  ];

  // 添加红旗征节点
  item.redFlags?.forEach((flag, idx) => {
    nodes.push({ id: `flag-${idx}`, name: flag, category: 1, symbolSize: 30 });
    links.push({ source: 'root', target: `flag-${idx}`, value: '红旗征' });
  });

  // 添加伴随症状节点
  item.associatedSymptoms?.forEach((sym, idx) => {
    nodes.push({ id: `sym-${idx}`, name: sym, category: 2, symbolSize: 30 });
    links.push({ source: 'root', target: `sym-${idx}`, value: '伴随' });
  });

  // 添加常见病因节点
  item.commonCauses?.forEach((cause, idx) => {
    nodes.push({ id: `cause-${idx}`, name: cause, category: 3, symbolSize: 35 });
    links.push({ source: 'root', target: `cause-${idx}`, value: '病因' });
  });

  return { nodes, links, categories };
}

// 构建 Markdown 内容
function buildMarkdownContent(item: KnowledgeItem): string {
  const sections: string[] = [];
  
  // 标题
  sections.push(`# ${item.displayName}`);
  
  // 定义
  if (item.description) {
    sections.push(`## 定义\n${item.description}`);
  }
  
  // 红旗征
  if (item.redFlags && item.redFlags.length > 0) {
    sections.push(`## 红旗征(Red Flags)\n${item.redFlags.map(f => `- 🚩 **${f}**`).join('\n')}`);
  }
  
  // 伴随症状
  if (item.associatedSymptoms && item.associatedSymptoms.length > 0) {
    sections.push(`## 伴随症状\n${item.associatedSymptoms.map(s => `- ${s}`).join('\n')}`);
  }
  
  // 问诊要点
  if (item.questions && item.questions.length > 0) {
    sections.push(`## 问诊要点\n${item.questions.map(q => `- ${q}`).join('\n')}`);
  }
  
  // 常见病因
  if (item.commonCauses && item.commonCauses.length > 0) {
    sections.push(`## 常见病因\n${item.commonCauses.map((c, i) => `${i + 1}. **${c}**`).join('\n')}`);
  }
  
  // 体格检查
  if (item.physicalSigns && item.physicalSigns.length > 0) {
    sections.push(`## 体格检查要点\n${item.physicalSigns.map(s => `- ${s}`).join('\n')}`);
  }
  
  return sections.join('\n\n');
}

// 构建菜单项
function buildMenuItems(knowledgeList: KnowledgeItem[]) {
  // 按分类分组
  const grouped = knowledgeList.reduce((acc, item) => {
    const category = item.category || '常见症状';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, KnowledgeItem[]>);

  // 构建菜单结构
  const categories = Object.keys(grouped);
  
  return [
    {
      key: 'symptoms',
      icon: <MedicineBoxOutlined />,
      label: '常见症状',
      children: categories.map(cat => ({
        key: `cat-${cat}`,
        label: cat,
        children: grouped[cat].map(k => ({
          key: k.symptomKey,
          label: k.displayName,
          icon: <FileTextOutlined />
        }))
      }))
    },
    {
      key: 'skills',
      icon: <ExperimentOutlined />,
      label: '问诊技术',
      children: [
        { key: 'basic', label: '基本原则', children: [{ key: 'communication', label: '沟通技巧' }] },
        { key: 'special', label: '特殊人群', children: [{ key: 'elderly', label: '老年人问诊' }, { key: 'children', label: '儿童问诊' }] }
      ]
    }
  ];
}

const Knowledge: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 获取知识库列表
  const fetchKnowledgeList = useCallback(async () => {
    setLoading(true);
    try {
      const res: ApiResponse<KnowledgeItem[]> = await api.get('/knowledge');
      const data = unwrapData<KnowledgeItem[]>(res);
      if (data) {
        setKnowledgeList(data);
        logger.info('[Knowledge] 已加载知识库列表', { count: data.length });
      }
    } catch (err) {
      logger.error('[Knowledge] 获取知识库列表失败', err);
      message.error('获取知识库列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeList();
  }, [fetchKnowledgeList]);

  // 当前选中的知识项
  const currentItem = useMemo(() => {
    return knowledgeList.find(k => k.symptomKey === selectedKey);
  }, [knowledgeList, selectedKey]);

  // 当前数据（包含构建的图谱和Markdown）
  const currentData = useMemo(() => {
    if (!currentItem) return null;
    return {
      title: currentItem.displayName,
      tags: [currentItem.category || '常见症状', ...(currentItem.bodySystems || [])],
      content: buildMarkdownContent(currentItem),
      graph: buildGraphData(currentItem)
    };
  }, [currentItem]);

  // 菜单项
  const menuItems = useMemo(() => buildMenuItems(knowledgeList), [knowledgeList]);

  // 过滤后的列表
  const filteredList = useMemo(() => {
    if (!searchTerm) return knowledgeList;
    return knowledgeList.filter(k => 
      k.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      k.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [knowledgeList, searchTerm]);

  const onMenuSelect = ({ key }: { key: string }) => {
    const item = knowledgeList.find(k => k.symptomKey === key);
    if (item) {
      setSelectedKey(key);
    }
  };

  const handleNodeClick = () => {
    // Future: Navigate to clicked node if it exists in knowledge base
  };

  return (
    <Layout className="knowledge-page msia-page" style={{ height: 'calc(100vh - 64px)' }}>
      <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0', overflowY: 'auto' }}>
        <div style={{ padding: 16 }}>
          <Search 
            placeholder="搜索知识库..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onSearch={(value) => {
              const item = knowledgeList.find(k => 
                k.displayName.includes(value) || k.description?.includes(value)
              );
              if (item) setSelectedKey(item.symptomKey);
            }}
          />
        </div>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        ) : (
          <Menu
            mode="inline"
            defaultOpenKeys={['symptoms']}
            style={{ borderRight: 0 }}
            items={menuItems}
            onSelect={onMenuSelect}
            selectedKeys={selectedKey ? [selectedKey] : []}
          />
        )}
      </Sider>
      
      <Layout style={{ padding: '0 24px 24px' }}>
        <Breadcrumb style={{ margin: '16px 0' }} items={[
            { title: <ReadOutlined /> },
            { title: '知识库' },
            { title: currentData?.title || '未选择' }
        ]} />
        <Content
          className="site-layout-background"
          style={{
            padding: 24,
            margin: 0,
            minHeight: 280,
            background: '#fff',
            overflowY: 'auto'
          }}
        >
          {currentData ? (
            <Row gutter={24}>
              <Col span={16}>
                <div style={{ marginBottom: 16 }}>
                  {currentData.tags.map(tag => (
                    <Tag key={tag} color="blue">{tag}</Tag>
                  ))}
                </div>
                <Title level={2}>{currentData.title}</Title>
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {currentData.content}
                  </ReactMarkdown>
                </div>
              </Col>
              <Col span={8}>
                <Card title="知识图谱" variant="borderless" className="knowledge-graph-card">
                   <KnowledgeGraph data={currentData.graph} onNodeClick={handleNodeClick} />
                </Card>
              </Col>
            </Row>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Empty description={loading ? '加载中...' : '请从左侧菜单选择要查看的知识条目'} />
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default Knowledge;
