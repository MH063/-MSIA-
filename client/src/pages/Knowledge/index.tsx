import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Menu, Breadcrumb, Typography, Card, Input, Tag, Row, Col, Spin, Grid, App, Drawer, Button } from 'antd';
import { 
  ReadOutlined, 
  MedicineBoxOutlined, 
  ExperimentOutlined,
  FileTextOutlined,
  BookOutlined,
  MenuOutlined,
  SearchOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import KnowledgeGraph from '../../components/KnowledgeGraph';
import api, { unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import logger from '../../utils/logger';
import './index.css';

const { Title, Text } = Typography;
const { Search } = Input;
const { useBreakpoint } = Grid;

/**
 * 知识库条目类型
 */
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

/**
 * 图谱数据类型
 */
interface GraphData {
  nodes: { id: string; name: string; category: number; symbolSize?: number }[];
  links: { source: string; target: string; value?: string }[];
  categories: { name: string }[];
}

/**
 * 构建图谱数据
 */
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

  item.redFlags?.forEach((flag, idx) => {
    nodes.push({ id: `flag-${idx}`, name: flag, category: 1, symbolSize: 30 });
    links.push({ source: 'root', target: `flag-${idx}`, value: '红旗征' });
  });

  item.associatedSymptoms?.forEach((sym, idx) => {
    nodes.push({ id: `sym-${idx}`, name: sym, category: 2, symbolSize: 30 });
    links.push({ source: 'root', target: `sym-${idx}`, value: '伴随' });
  });

  item.commonCauses?.forEach((cause, idx) => {
    nodes.push({ id: `cause-${idx}`, name: cause, category: 3, symbolSize: 35 });
    links.push({ source: 'root', target: `cause-${idx}`, value: '病因' });
  });

  return { nodes, links, categories };
}

/**
 * 构建 Markdown 内容
 */
function buildMarkdownContent(item: KnowledgeItem): string {
  const sections: string[] = [];
  
  sections.push(`# ${item.displayName}`);
  
  if (item.description) {
    sections.push(`## 定义\n${item.description}`);
  }
  
  if (item.redFlags && item.redFlags.length > 0) {
    sections.push(`## 红旗征(Red Flags)\n${item.redFlags.map(f => `- 🚩 **${f}**`).join('\n')}`);
  }
  
  if (item.associatedSymptoms && item.associatedSymptoms.length > 0) {
    sections.push(`## 伴随症状\n${item.associatedSymptoms.map(s => `- ${s}`).join('\n')}`);
  }
  
  if (item.questions && item.questions.length > 0) {
    sections.push(`## 问诊要点\n${item.questions.map(q => `- ${q}`).join('\n')}`);
  }
  
  if (item.commonCauses && item.commonCauses.length > 0) {
    sections.push(`## 常见病因\n${item.commonCauses.map((c, i) => `${i + 1}. **${c}**`).join('\n')}`);
  }
  
  if (item.physicalSigns && item.physicalSigns.length > 0) {
    sections.push(`## 体格检查要点\n${item.physicalSigns.map(s => `- ${s}`).join('\n')}`);
  }
  
  return sections.join('\n\n');
}

/**
 * 构建菜单项
 */
function buildMenuItems(knowledgeList: KnowledgeItem[]) {
  const grouped = knowledgeList.reduce((acc, item) => {
    const category = item.category || '常见症状';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, KnowledgeItem[]>);

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

/**
 * 知识库页面组件
 * 展示医学知识库内容，支持分类浏览和搜索
 */
const Knowledge: React.FC = () => {
  const { message } = App.useApp();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.lg;

  /**
   * 获取知识库列表
   */
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
  }, [message]);

  useEffect(() => {
    fetchKnowledgeList();
  }, [fetchKnowledgeList]);

  /**
   * 当前选中的知识项
   */
  const currentItem = useMemo(() => {
    return knowledgeList.find(k => k.symptomKey === selectedKey);
  }, [knowledgeList, selectedKey]);

  /**
   * 当前数据（包含构建的图谱和Markdown）
   */
  const currentData = useMemo(() => {
    if (!currentItem) return null;
    return {
      title: currentItem.displayName,
      tags: [currentItem.category || '常见症状', ...(currentItem.bodySystems || [])],
      content: buildMarkdownContent(currentItem),
      graph: buildGraphData(currentItem)
    };
  }, [currentItem]);

  /**
   * 菜单项
   */
  const menuItems = useMemo(() => buildMenuItems(knowledgeList), [knowledgeList]);

  /**
   * 处理菜单选择
   */
  const onMenuSelect = ({ key }: { key: string }) => {
    const item = knowledgeList.find(k => k.symptomKey === key);
    if (item) {
      setSelectedKey(key);
      if (isMobile) {
        setDrawerOpen(false);
      }
    }
  };

  /**
   * 处理节点点击
   */
  const handleNodeClick = () => {
    // Future: Navigate to clicked node if it exists in knowledge base
  };

  /**
   * 渲染侧边栏内容
   */
  const renderSiderContent = () => (
    <>
      {/* 搜索区域 */}
      <div className="knowledge-sider-header">
        <Search 
          placeholder="搜索知识库..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onSearch={(value) => {
            const item = knowledgeList.find(k => 
              k.displayName.includes(value) || k.description?.includes(value)
            );
            if (item) {
              setSelectedKey(item.symptomKey);
              if (isMobile) {
                setDrawerOpen(false);
              }
            }
          }}
          className="knowledge-sider-search"
        />
      </div>
      
      {/* 菜单列表 */}
      {loading ? (
        <div className="knowledge-loading">
          <Spin size="small" />
          <Text className="knowledge-loading-text">加载中...</Text>
        </div>
      ) : (
        <Menu
          mode="inline"
          defaultOpenKeys={['symptoms']}
          items={menuItems}
          onSelect={onMenuSelect}
          selectedKeys={selectedKey ? [selectedKey] : []}
        />
      )}
    </>
  );

  return (
    <div className="knowledge-page msia-page">
      {/* 页面头部 */}
      <div className="knowledge-header">
        <div className="knowledge-header-content">
          <Title level={2} className="knowledge-title">医学知识库</Title>
          <Text className="knowledge-subtitle">
            系统化的医学知识体系，助力临床问诊学习
          </Text>
        </div>
        {isMobile && (
          <Button 
            type="primary"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            className="knowledge-menu-btn"
          >
            分类导航
          </Button>
        )}
      </div>

      <div className="knowledge-body">
        {/* 桌面端侧边栏 */}
        {!isMobile && (
          <div className="knowledge-sider">
            {renderSiderContent()}
          </div>
        )}

        {/* 移动端抽屉 */}
        {isMobile && (
          <Drawer
            title="知识分类"
            placement="left"
            onClose={() => setDrawerOpen(false)}
            open={drawerOpen}
            width={280}
            className="knowledge-drawer"
          >
            {renderSiderContent()}
          </Drawer>
        )}

        {/* 内容区域 */}
        <div className="knowledge-content">
          {/* 面包屑导航 */}
          <Breadcrumb items={[
            { title: <><ReadOutlined /> <span>知识库</span></> },
            { title: currentData?.title || '请选择条目' }
          ]} />
          
          {/* 内容卡片 */}
          {currentData ? (
            <div className="knowledge-content-card">
              {/* 内容头部 */}
              <div className="knowledge-content-header">
                <Title level={3} className="knowledge-content-title">{currentData.title}</Title>
                <div className="knowledge-tags-wrapper">
                  {currentData.tags.map(tag => (
                    <Tag key={tag} color="blue">{tag}</Tag>
                  ))}
                </div>
              </div>
              
              {/* 内容主体 */}
              <div className="knowledge-content-body">
                <Row gutter={24}>
                  {/* Markdown 内容 */}
                  <Col xs={24} xl={16}>
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {currentData.content}
                      </ReactMarkdown>
                    </div>
                  </Col>
                  
                  {/* 知识图谱 */}
                  <Col xs={24} xl={8}>
                    <Card 
                      title={<><BookOutlined /> 知识图谱</>} 
                      variant="borderless" 
                      className="knowledge-graph-card"
                    >
                      <KnowledgeGraph data={currentData.graph} onNodeClick={handleNodeClick} />
                    </Card>
                  </Col>
                </Row>
              </div>
            </div>
          ) : (
            /* 空状态 */
            <div className="knowledge-empty">
              <div className="knowledge-empty-icon">
                <BookOutlined />
              </div>
              <div className="knowledge-empty-title">
                {loading ? '加载中...' : '医学知识库'}
              </div>
              <div className="knowledge-empty-desc">
                {loading ? '正在获取知识库数据...' : isMobile ? '点击上方"分类导航"按钮浏览知识条目' : '请从左侧菜单选择知识条目，或使用搜索功能快速查找'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Knowledge;
