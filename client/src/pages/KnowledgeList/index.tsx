import React, { useEffect, useState, useMemo } from 'react';
import { Layout, Typography, Tabs, Space, Empty, Spin, Input, Tree, Breadcrumb, Button } from 'antd';
import { BookOutlined, ShareAltOutlined, FileTextOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import api, { unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import KnowledgeGraph from './components/KnowledgeGraph';
import './index.css';

const { Sider, Content } = Layout;
const { Title } = Typography;
const { Search } = Input;

interface KnowledgeItem {
  id: string;
  symptomKey: string;
  symptomName: string;
  category?: string;
  description?: string;
  redFlags?: string[];
  relatedSymptoms?: string[];
  questions?: string[];
}

const KnowledgeList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [activeTab, setActiveTab] = useState('detail');

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res: ApiResponse<KnowledgeItem[]> = await api.get('/knowledge/symptom-mappings');
      console.log('[KnowledgeList] API响应:', res);
      if (res?.success) {
        const payload = unwrapData<KnowledgeItem[]>(res);
        console.log('[KnowledgeList] 解包数据:', payload);
        if (payload && payload.length > 0) {
          setKnowledgeList(payload);
        } else {
          setKnowledgeList([]);
        }
      }
    } catch (err) {
      console.error('[KnowledgeList] 获取知识库数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedItem = useMemo(() => {
    return knowledgeList.find(k => k.id === selectedKey);
  }, [knowledgeList, selectedKey]);

  // Construct Tree Data (Mock 3 levels)
  const treeData = useMemo(() => {
    const categories = Array.from(new Set(knowledgeList.map(k => k.category || 'Uncategorized')));
    return [
      {
        title: '临床医学',
        key: 'root',
        children: categories.map(cat => ({
          title: cat === 'respiratory' ? '呼吸系统' : (cat === 'digestive' ? '消化系统' : cat),
          key: `cat-${cat}`,
          children: knowledgeList
            .filter(k => (k.category || 'Uncategorized') === cat)
            .map(k => ({
              title: k.symptomName,
              key: k.id,
              icon: <FileTextOutlined />
            }))
        }))
      }
    ];
  }, [knowledgeList]);

  // Construct Graph Data
  const graphData = useMemo(() => {
    if (!selectedItem) return { nodes: [], links: [], categories: [] };
    
    const nodes = [
      { id: 'root', name: selectedItem.symptomName, category: 0, symbolSize: 50 }
    ];
    const links: { source: string; target: string }[] = [];
    const categories = [{ name: '核心症状' }, { name: '红旗征' }, { name: '伴随症状' }];

    selectedItem.redFlags?.forEach((flag, idx) => {
      nodes.push({ id: `flag-${idx}`, name: flag, category: 1, symbolSize: 30 });
      links.push({ source: 'root', target: `flag-${idx}` });
    });

    selectedItem.relatedSymptoms?.forEach((sym, idx) => {
      nodes.push({ id: `sym-${idx}`, name: sym, category: 2, symbolSize: 30 });
      links.push({ source: 'root', target: `sym-${idx}` });
    });

    return { nodes, links, categories };
  }, [selectedItem]);

  // Markdown Content Generation (Mock)
  const markdownContent = useMemo(() => {
    if (!selectedItem) return '';
    return `
# ${selectedItem.symptomName}

## 定义
${selectedItem.description || '暂无描述'}

## 红旗征 (Red Flags)
${selectedItem.redFlags?.map((f: string) => `- 🚩 **${f}**`).join('\n') || '无'}

## 伴随症状
${selectedItem.relatedSymptoms?.map((s: string) => `- ${s}`).join('\n') || '无'}

## 问诊要点
${selectedItem.questions?.map((q: string) => `- ${q}`).join('\n') || '无'}

## 鉴别诊断
- **疾病A**: ...
- **疾病B**: ...

> *注：本内容仅供参考，请结合临床实际情况。*
    `;
  }, [selectedItem]);

  return (
    <div className="knowledge-page msia-page" style={{ padding: 0, height: 'calc(100vh - 64px)' }}>
      <Layout style={{ height: '100%', background: 'transparent' }}>
        <Sider width={280} theme="light" style={{ borderRight: '1px solid var(--msia-border)', overflowY: 'auto' }}>
          <div style={{ padding: 16 }}>
            <Search placeholder="搜索知识点" style={{ marginBottom: 16 }} />
            <Tree
              defaultExpandedKeys={['root']}
              selectedKeys={[selectedKey]}
              onSelect={(keys) => {
                 if (keys.length > 0 && !keys[0].toString().startsWith('cat-') && keys[0] !== 'root') {
                    setSelectedKey(keys[0].toString());
                 }
              }}
              treeData={treeData}
              blockNode
            />
          </div>
        </Sider>
        <Content style={{ padding: 24, overflowY: 'auto' }}>
          {selectedItem ? (
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              <Breadcrumb
                items={[
                  { title: '知识库' },
                  { title: '临床医学' },
                  { title: selectedItem.category || '未分类' },
                  { title: selectedItem.symptomName }
                ]}
                style={{ marginBottom: 16 }}
              />
              <div style={{ background: 'var(--msia-card)', padding: 32, borderRadius: 16, minHeight: 600 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <Title level={2} style={{ margin: 0 }}>{selectedItem.symptomName}</Title>
                  <Space>
                    <Button icon={<ShareAltOutlined />}>分享</Button>
                    <Button type="primary" icon={<BookOutlined />}>引用</Button>
                  </Space>
                </div>

                <Tabs 
                  activeKey={activeTab} 
                  onChange={setActiveTab}
                  items={[
                    {
                      key: 'detail',
                      label: <span><FileTextOutlined /> 详情内容</span>,
                      children: (
                        <div className="markdown-body">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]} 
                            rehypePlugins={[rehypeRaw]}
                          >
                            {markdownContent}
                          </ReactMarkdown>
                        </div>
                      )
                    },
                    {
                      key: 'graph',
                      label: <span><DeploymentUnitOutlined /> 知识图谱</span>,
                      children: <KnowledgeGraph data={graphData} />
                    }
                  ]}
                />
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               {loading ? <Spin size="large" /> : <Empty description="请选择左侧知识点" />}
            </div>
          )}
        </Content>
      </Layout>
    </div>
  );
};

export default KnowledgeList;
