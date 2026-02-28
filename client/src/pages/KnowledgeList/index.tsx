import React, { useEffect, useState, useMemo } from 'react';
import { Layout, Typography, Tabs, Space, Empty, Input, Tree, Breadcrumb, Button, Tag, theme, Grid, Drawer, FloatButton, message, Spin, App } from 'antd';
import { BookOutlined, ShareAltOutlined, FileTextOutlined, DeploymentUnitOutlined, MenuOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { useSearchParams } from 'react-router-dom';
import api, { unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import KnowledgeGraph from './components/KnowledgeGraph';
import { useThemeStore } from '../../store/theme.store';
import logger from '../../utils/logger';
import './index.css';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;
const { useBreakpoint } = Grid;

type ServerSymptomMapping = {
  symptomKey: string;
  displayName: string;
  category?: string | null;
  description?: string | null;
  redFlags?: unknown;
  associatedSymptoms?: unknown;
  questions?: unknown;
};

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

interface SessionSearchItem {
  id: number;
  patient?: { name?: string; gender?: string };
  createdAt: string;
  status: string;
}

interface SessionSearchPayload {
  items: SessionSearchItem[];
  total: number;
}

/**
 * 知识库列表页面
 * 展示医学知识库内容，支持分类浏览和搜索
 */
const KnowledgeList: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { mode } = useThemeStore();
  const screens = useBreakpoint();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [activeTab, setActiveTab] = useState('detail');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['root']);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionSearchItem[]>([]);
  const [symptomMatches, setSymptomMatches] = useState<Array<{ name: string; key: string }>>([]);

  // 判断是否为移动端
  const isMobile = !screens.md;

  // 初始化搜索参数
  useEffect(() => {
    const query = searchParams.get('search');
    if (query) {
      setSearchTerm(query);
    }
  }, [searchParams]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res: ApiResponse<ServerSymptomMapping[]> = await api.get('/knowledge/symptom-mappings');
      const payload = unwrapData<ServerSymptomMapping[]>(res) || [];
      const mapped: KnowledgeItem[] = (payload || []).map((it) => {
        const redFlags = Array.isArray(it.redFlags) ? (it.redFlags as unknown[]).map(String) : [];
        const related = Array.isArray(it.associatedSymptoms) ? (it.associatedSymptoms as unknown[]).map(String) : [];
        const questions = Array.isArray(it.questions) ? (it.questions as unknown[]).map(String) : [];
        return {
          id: it.symptomKey,
          symptomKey: it.symptomKey,
          symptomName: it.displayName || it.symptomKey,
          category: it.category || '常见症状',
          description: typeof it.description === 'string' ? it.description : undefined,
          redFlags,
          relatedSymptoms: related,
          questions,
        };
      });
      setKnowledgeList(mapped);
      logger.info('[KnowledgeList] 已加载知识库映射', { count: mapped.length });
    } catch (err) {
      logger.error('[KnowledgeList] 获取知识库数据失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * 聚合搜索：病历 + 症状映射
   */
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSessionResults([]);
      setSymptomMatches([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        setSessionsLoading(true);
        const safe = term.replace(/['"<>]/g, '');
        const resp = (await api.get('/sessions', { params: { search: safe, limit: 5 } })) as ApiResponse<SessionSearchPayload | { data: SessionSearchPayload }>;
        const payload = unwrapData<SessionSearchPayload>(resp);
        if (alive) setSessionResults((payload?.items || []).slice(0, 5));
      } catch (e) {
        logger.error('[KnowledgeList] 病历搜索失败', e);
      } finally {
        setSessionsLoading(false);
      }
    })();

    (async () => {
      try {
        const resp = (await api.get('/mapping/symptoms')) as ApiResponse<{ nameToKey: Record<string, string>; synonyms: Record<string, string> }>;
        const payload = unwrapData<{ nameToKey: Record<string, string>; synonyms: Record<string, string> }>(resp);
        const nameToKey = payload?.nameToKey || {};
        const synonyms = payload?.synonyms || {};
        const names = Object.keys(nameToKey);
        const matchedNames = names.filter(n => String(n).toLowerCase().includes(term.toLowerCase()));
        const matchedSynonyms = Object.entries(synonyms)
          .filter(([synonym]) => String(synonym).toLowerCase().includes(term.toLowerCase()))
          .map(([, canonical]) => canonical)
          .filter(Boolean);
        const union = Array.from(new Set([...matchedNames, ...matchedSynonyms]));
        const results = union.map(name => ({ name, key: nameToKey[name] || name.toLowerCase().replace(/\s+/g, '_') }));
        setSymptomMatches(results.slice(0, 10));
      } catch (e) {
        logger.error('[KnowledgeList] 症状映射搜索失败', e);
      }
    })();

    return () => { alive = false; };
  }, [searchTerm]);

  const selectedItem = useMemo(() => {
    return knowledgeList.find(k => k.id === selectedKey);
  }, [knowledgeList, selectedKey]);

  // 过滤列表
  const filteredList = useMemo(() => {
    if (!searchTerm) return knowledgeList;
    return knowledgeList.filter(k => 
      k.symptomName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      k.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [knowledgeList, searchTerm]);

  // Construct Tree Data (Mock 3 levels)
  const treeData = useMemo(() => {
    if (!filteredList || filteredList.length === 0) {
      return [{
        title: '临床医学',
        key: 'root',
        children: [{
          title: '常见症状',
          key: 'cat-常见症状',
          children: []
        }]
      }];
    }
    const categories = Array.from(new Set(filteredList.map(k => k.category || '常见症状')));
    return [
      {
        title: '临床医学',
        key: 'root',
        children: categories.filter(Boolean).map(cat => ({
          title: cat === 'respiratory' ? '呼吸系统' : (cat === 'digestive' ? '消化系统' : cat),
          key: `cat-${cat}`,
          children: filteredList
            .filter(k => (k.category || '常见症状') === cat)
            .map((k, idx) => ({
              title: k.symptomName,
              key: k.id || k.symptomKey || `item-${idx}`,
              icon: <FileTextOutlined />
            }))
        }))
      }
    ];
  }, [filteredList]);

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

## 红旗征(Red Flags)
${selectedItem.redFlags?.map((f: string) => `- 🚩 **${f}**`).join('\n') || '暂无'}

## 伴随症状
${selectedItem.relatedSymptoms?.map((s: string) => `- ${s}`).join('\n') || '暂无'}

## 问诊要点
${selectedItem.questions?.map((q: string) => `- ${q}`).join('\n') || '暂无'}

## 鉴别诊断
暂无

> *注：本内容仅供参考，请结合临床实际情况判断*
    `;
  }, [selectedItem]);

  /**
   * Tabs 配置项，使用 useMemo 缓存避免每次渲染重新创建
   */
  const tabItems = useMemo(() => [
    {
      key: 'detail',
      label: <span><FileTextOutlined /> 详情内容</span>,
      children: (
        <div className="markdown-body" style={{ color: token.colorText }}>
          <ReactMarkdown 
            rehypePlugins={[rehypeRaw]} 
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ node, ...props }) => { void node; return <h1 style={{ color: token.colorTextHeading }} {...props} />; },
              h2: ({ node, ...props }) => { void node; return <h2 style={{ color: token.colorTextHeading, borderBottom: `1px solid ${token.colorBorder}` }} {...props} />; },
              p: ({ node, ...props }) => { void node; return <p style={{ color: token.colorText }} {...props} />; },
              strong: ({ node, ...props }) => { void node; return <strong style={{ color: token.colorTextHeading }} {...props} />; },
              li: ({ node, ...props }) => { void node; return <li style={{ color: token.colorText }} {...props} />; },
            }}
          >
            {markdownContent}
          </ReactMarkdown>
        </div>
      )
    },
    {
      key: 'graph',
      label: <span><DeploymentUnitOutlined /> 知识图谱</span>,
      children: (
        <div style={{ height: 500, background: token.colorBgLayout, borderRadius: 8, padding: 16, overflow: 'hidden' }}>
          <KnowledgeGraph data={graphData} />
        </div>
      )
    }
  ], [token, markdownContent, graphData]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      message.success('链接已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败，请手动复制');
    });
  };

  const handleQuote = () => {
    if (!selectedItem) return;
    const date = new Date().toLocaleDateString();
    const text = `[1] ${selectedItem.symptomName}. 医学生智能问诊辅助系统（MSIA）. 检索于 ${date}.`;
    navigator.clipboard.writeText(text).then(() => {
      message.success('引用格式已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const SidebarContent = (
    <div className="knowledge-sider-content">
      <div className="knowledge-sider-search-wrapper">
        <Search 
          placeholder="搜索知识库" 
          value={searchTerm}
          onChange={(e) => {
            const raw = e.target.value;
            const safe = raw.replace(/['"<>]/g, '');
            setSearchTerm(safe);
            // Update URL param
            if (safe) {
              setSearchParams({ search: safe });
            } else {
              setSearchParams({});
            }
          }}
          allowClear
          className="knowledge-sider-search"
        />
      </div>
      <div className="knowledge-tree-wrapper">
        <Tree
          expandedKeys={expandedKeys}
          selectedKeys={[selectedKey]}
          onExpand={(keys) => setExpandedKeys(keys as string[])}
          onSelect={(keys) => {
            const k = keys[0]?.toString();
            if (!k) return;
            if (k === 'root' || k.startsWith('cat-')) {
              const next = new Set(expandedKeys);
              if (next.has(k)) next.delete(k); else next.add(k);
              setExpandedKeys(Array.from(next));
              return;
            }
            setSelectedKey(k);
            if (isMobile) setMobileDrawerOpen(false);
          }}
          treeData={treeData}
          blockNode
        />
      </div>
    </div>
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
            onClick={() => setMobileDrawerOpen(true)}
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
            {SidebarContent}
          </div>
        )}

        {/* 移动端抽屉 */}
        {isMobile && (
          <Drawer
            title="知识库导航"
            placement="left"
            onClose={() => setMobileDrawerOpen(false)}
            open={mobileDrawerOpen}
            size="default"
            className="knowledge-drawer"
          >
            {SidebarContent}
          </Drawer>
        )}

        {/* 内容区域 */}
        <div className="knowledge-content">
          {selectedItem ? (
            <div className="knowledge-detail-wrapper">
              <Breadcrumb
                className="knowledge-breadcrumb"
                items={[
                  { title: <a onClick={() => { setSelectedKey(''); setSearchTerm(''); setSearchParams({}); }}>知识库</a> },
                  { title: <a onClick={() => { setSelectedKey(''); }}>临床医学</a> },
                  { title: selectedItem.category || '常见症状' },
                  { title: selectedItem.symptomName }
                ]}
              />
              <div className="knowledge-detail-card">
                <div className="knowledge-detail-header">
                  <Title level={3} className="knowledge-detail-title">{selectedItem.symptomName}</Title>
                  <Space>
                    <Button icon={<ShareAltOutlined />} onClick={handleShare} className="knowledge-btn-default">分享</Button>
                    <Button type="primary" icon={<BookOutlined />} onClick={handleQuote} className="knowledge-btn-primary">引用</Button>
                  </Space>
                </div>

                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  destroyOnHidden={false}
                  items={tabItems}
                  className="knowledge-tabs"
                />
              </div>
            </div>
          ) : (
            <div className="knowledge-empty-wrapper">
              {loading ? (
                <div className="knowledge-loading">
                  <Spin size="large" />
                  <Text className="knowledge-loading-text">加载知识库数据...</Text>
                </div>
              ) : (
                <div className="knowledge-empty-state">
                  {searchTerm ? (
                    <div className="knowledge-search-results">
                      <div className="knowledge-search-header">
                        <Title level={4}>搜索结果：{searchTerm}</Title>
                      </div>
                      
                      {/* 病历匹配 */}
                      <div className="knowledge-search-section">
                        <Title level={5}>病历匹配</Title>
                        {sessionsLoading ? (
                          <div className="knowledge-section-loading">
                            <Spin />
                          </div>
                        ) : sessionResults.length > 0 ? (
                          <div className="knowledge-session-list">
                            {sessionResults.map((s) => (
                              <div key={s.id} className="knowledge-session-item">
                                <div className="knowledge-session-info">
                                  <Tag color="processing">ID {s.id}</Tag>
                                  <span>{s.patient?.name || '未知患者'}</span>
                                  <span className="knowledge-session-time">{new Date(s.createdAt).toLocaleString()}</span>
                                </div>
                                <Button size="small" type="primary" onClick={() => window.location.assign(`/interview/${s.id}`)}>进入详情</Button>
                              </div>
                            ))}
                            <div className="knowledge-view-all">
                              <Button type="link" onClick={() => window.location.assign(`/sessions?search=${encodeURIComponent(searchTerm)}`)}>查看全部病历</Button>
                            </div>
                          </div>
                        ) : (
                          <Empty description="无病历匹配" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                      </div>

                      {/* 症状候选 */}
                      <div className="knowledge-search-section">
                        <Title level={5}>症状候选</Title>
                        {symptomMatches.length > 0 ? (
                          <div className="knowledge-tag-list">
                            {symptomMatches.map(it => (
                              <Tag key={it.key} color="blue">{it.name}</Tag>
                            ))}
                          </div>
                        ) : (
                          <Empty description="无症状候选匹配" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                      </div>

                      {/* 知识库词条匹配 */}
                      <div className="knowledge-search-section">
                        <Title level={5}>知识库词条匹配</Title>
                        {filteredList.length > 0 ? (
                          <div className="knowledge-tag-list">
                            {filteredList.slice(0, 20).map(k => (
                              <Tag key={k.id} color="purple" onClick={() => setSelectedKey(k.id)} className="knowledge-clickable-tag">{k.symptomName}</Tag>
                            ))}
                          </div>
                        ) : (
                          <Empty description="无知识库匹配" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                      </div>
                    </div>
                  ) : (
                    <Empty 
                      description="请选择左侧知识项" 
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      className="knowledge-empty"
                    >
                      {isMobile && <Button type="primary" onClick={() => setMobileDrawerOpen(true)}>打开目录</Button>}
                    </Empty>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 移动端浮动按钮 */}
      {isMobile && (
        <FloatButton 
          icon={<MenuOutlined />} 
          type="primary" 
          onClick={() => setMobileDrawerOpen(true)}
          className="knowledge-float-btn"
        />
      )}
    </div>
  );
};

export default KnowledgeList;
