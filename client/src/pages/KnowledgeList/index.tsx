import React, { useEffect, useRef, useState } from 'react';
import { Card, Typography, Tag, Input, Drawer, Space, Spin, Empty, Button, Row, Col, Collapse, Segmented, message } from 'antd';
import { SearchOutlined, BookOutlined, MedicineBoxOutlined, ExclamationCircleOutlined, QuestionCircleOutlined, AppstoreOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const host = window.location.hostname;
const isProduction = import.meta.env.PROD;

type QuestionItem = string | { id: string; text: string; type: string; options?: string[] };

interface KnowledgeItem {
  id: number;
  symptomKey: string;
  displayName: string;
  requiredQuestions: QuestionItem[];
  associatedSymptoms: string[];
  redFlags: string[];
  physicalSigns?: string[];
  updatedAt: string;
}

const KnowledgeList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KnowledgeItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'网格' | '按首字母' | '按更新时间'>('网格');
  const prevMapRef = useRef<Map<number, string>>(new Map());
  const lastUpdatedAtRef = useRef<string>('');
  const esRef = useRef<EventSource | null>(null);

  /**
   * fetchData
   * 拉取知识库列表数据
   */
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = lastUpdatedAtRef.current ? { since: lastUpdatedAtRef.current } : undefined;
      const res: ApiResponse<KnowledgeItem[]> = await api.get('/knowledge', { params });
      if (res.success && Array.isArray(res.data)) {
        const incoming = res.data;
        if (!lastUpdatedAtRef.current) {
          // 初次加载：全量替换
          setData(incoming);
          const map = new Map<number, string>();
          let maxUpdated = '';
          for (const it of incoming) {
            map.set(it.id, it.updatedAt);
            if (!maxUpdated || new Date(it.updatedAt).getTime() > new Date(maxUpdated).getTime()) {
              maxUpdated = it.updatedAt;
            }
          }
          prevMapRef.current = map;
          lastUpdatedAtRef.current = maxUpdated;
        } else {
          // 增量合并
          const byId = new Map<number, KnowledgeItem>();
          for (const it of data) byId.set(it.id, it);
          let changed = 0;
          let maxUpdated = lastUpdatedAtRef.current;
          for (const it of incoming) {
            const prev = byId.get(it.id);
            if (!prev || prev.updatedAt !== it.updatedAt) {
              changed++;
              byId.set(it.id, it);
            }
            if (new Date(it.updatedAt).getTime() > new Date(maxUpdated).getTime()) {
              maxUpdated = it.updatedAt;
            }
          }
          if (changed > 0) {
            message.success(`知识库已更新${changed}条，已自动刷新`);
          }
          lastUpdatedAtRef.current = maxUpdated;
          const merged = Array.from(byId.values());
          setData(merged);
          const map = new Map<number, string>();
          for (const it of merged) map.set(it.id, it.updatedAt);
          prevMapRef.current = map;
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const onFocus = () => fetchData();
    const onVis = () => { if (document.visibilityState === 'visible') fetchData(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const url = isProduction ? '/api/knowledge/stream' : `http://${host}:4000/api/knowledge/stream`;
    const es = new EventSource(url);
    es.onmessage = () => fetchData();
    es.addEventListener('knowledge_updated', () => fetchData());
    es.onerror = () => {};
    esRef.current = es;
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  /**
   * getPrimarySymptomTags
   * 生成主症状标签列表（仅使用已加入知识库的症状显示名）
   */
  const getPrimarySymptomTags = (): string[] => {
    const set = new Set<string>();
    data.forEach(it => {
      const name = String(it.displayName || '').trim();
      if (name && /[\u4e00-\u9fff]/.test(name)) {
        set.add(name);
      }
    });
    return Array.from(set).sort();
  };

  /**
   * toggleTag
   * 切换选择的标签
   */
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const has = prev.includes(tag);
      const next = has ? prev.filter(t => t !== tag) : [...prev, tag];
      console.log('[KnowledgeList] 标签筛选更新', next);
      return next;
    });
  };

  /**
   * applyFilters
   * 基于搜索文本与标签筛选数据（取消分组功能）
   */
  const applyFilters = (items: KnowledgeItem[]): KnowledgeItem[] => {
    const kw = searchText.trim();
    return items.filter(it => {
      // 文本匹配
      const matchText =
        !kw ||
        it.displayName.includes(kw) ||
        it.symptomKey.includes(kw) ||
        (it.associatedSymptoms && it.associatedSymptoms.some(s => s.includes(kw)));

      // 标签匹配：仅匹配主症状显示名
      const matchTags =
        selectedTags.length === 0 ||
        selectedTags.every(t => it.displayName === t);

      return matchText && matchTags;
    });
  };

  const filteredData = applyFilters(data);

  /**
   * groupByLetter
   * 按 symptomKey 首字母分组
   */
  const groupByLetter = (items: KnowledgeItem[]) => {
    const groups: Record<string, KnowledgeItem[]> = {};
    items.forEach(it => {
      const first = (it.symptomKey?.[0] || '#').toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(it);
    });
    return Object.keys(groups).sort().map(k => ({ key: k, label: k, items: groups[k] }));
  };

  /**
   * groupByUpdated
   * 按更新时间分组：7天内/本月内/更早
   */
  const groupByUpdated = (items: KnowledgeItem[]) => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const groups: { key: string; label: string; items: KnowledgeItem[] }[] = [
      { key: 'recent7', label: '7天内更新', items: [] },
      { key: 'month', label: '本月更新', items: [] },
      { key: 'older', label: '更早', items: [] }
    ];
    items.forEach(it => {
      const ts = new Date(it.updatedAt).getTime();
      if (now - ts <= sevenDaysMs) groups[0].items.push(it);
      else if (ts >= startOfMonth.getTime()) groups[1].items.push(it);
      else groups[2].items.push(it);
    });
    return groups.filter(g => g.items.length > 0);
  };

  /**
   * handleItemClick
   * 打开详情抽屉并记录选中项
   */
  const handleItemClick = (item: KnowledgeItem) => {
    console.log('[KnowledgeList] 打开详情抽屉', item);
    setSelectedItem(item);
    setDrawerVisible(true);
  };

  /**
   * closeDrawer
   * 关闭详情抽屉并清空选中项
   */
  const closeDrawer = () => {
    setDrawerVisible(false);
    setSelectedItem(null);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            <BookOutlined /> 症状知识库
          </Title>
          <Space>
             <Input 
                placeholder="搜索症状、关键词..." 
                prefix={<SearchOutlined />} 
                style={{ width: 300 }}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
              />
              <Button type="primary" onClick={fetchData}>刷新</Button>
              <Button onClick={() => navigate('/')}>返回首页</Button>
          </Space>
        </div>

        

        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <span style={{ color: '#8c8c8c' }}>视图模式：</span>
            <Segmented
              options={['网格', '按首字母', '按更新时间']}
              value={viewMode}
              onChange={(val) => {
                const v = String(val) as typeof viewMode;
                console.log('[KnowledgeList] 视图模式切换', v);
                setViewMode(v);
              }}
            />
          </Space>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Space wrap size={[8, 8]}>
            <span style={{ color: '#8c8c8c' }}>标签筛选：</span>
            {getPrimarySymptomTags().map(tag => (
              <Tag.CheckableTag
                key={tag}
                checked={selectedTags.includes(tag)}
                onChange={() => toggleTag(tag)}
              >
                {tag}
              </Tag.CheckableTag>
            ))}
          </Space>
        </div>

        <Spin spinning={loading}>
          {filteredData.length > 0 ? (
            viewMode === '网格' ? (
              <Row gutter={[16, 16]}>
                {filteredData.map((item) => (
                  <Col key={item.id} xs={24} sm={12} md={8} lg={6} xl={6} xxl={4}>
                    <Card
                      hoverable
                      onClick={() => handleItemClick(item)}
                      title={
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <MedicineBoxOutlined style={{ color: '#1890ff' }} />
                            <span style={{ fontWeight: 600, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{item.displayName}</span>
                          </div>
                          <div style={{ color: '#8c8c8c', fontSize: 12, paddingLeft: 24, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{item.symptomKey}</div>
                        </div>
                      }
                      styles={{ body: { height: 160, overflow: 'hidden' } }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>关联症状：</Text>
                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(item.associatedSymptoms || []).filter(s => /[\u4e00-\u9fff]/.test(String(s))).map((s, i) => (
                            <Tag key={i} style={{ marginBottom: 4 }}>{s}</Tag>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <>
                {(viewMode === '按首字母' ? groupByLetter(filteredData) : groupByUpdated(filteredData)).map(group => (
                  <div key={group.key} style={{ marginBottom: 16 }}>
                    <Title level={5} style={{ margin: '0 0 8px' }}>{group.label}</Title>
                    <Row gutter={[16, 16]}>
                      {group.items.map(item => (
                        <Col key={item.id} xs={24} sm={12} md={8} lg={6} xl={6} xxl={4}>
                          <Card
                            hoverable
                            onClick={() => handleItemClick(item)}
                            title={
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <MedicineBoxOutlined style={{ color: '#1890ff' }} />
                                  <span style={{ fontWeight: 600, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{item.displayName}</span>
                                </div>
                                <div style={{ color: '#8c8c8c', fontSize: 12, paddingLeft: 24, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{item.symptomKey}</div>
                              </div>
                            }
                            styles={{ body: { height: 160, overflow: 'hidden' } }}
                          >
                            <div style={{ marginBottom: 8 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>关联症状：</Text>
                              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {(item.associatedSymptoms || []).filter(s => /[\u4e00-\u9fff]/.test(String(s))).map((s, i) => (
                                  <Tag key={i} style={{ marginBottom: 4 }}>{s}</Tag>
                                ))}
                              </div>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))}
              </>
            )
          ) : (
            <Empty description="暂无相关知识条目" />
          )}
        </Spin>
      </Card>

      <Drawer
        title={selectedItem?.displayName}
        placement="right"
        size="large"
        onClose={closeDrawer}
        open={drawerVisible}
      >
        {selectedItem && (
          <Collapse
            defaultActiveKey={['required']}
            ghost
            items={[
              {
                key: 'required',
                label: <span style={{ fontWeight: 600 }}><QuestionCircleOutlined /> 必问问题</span>,
                children: (
                  <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6 }}>
                    {selectedItem.requiredQuestions?.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {selectedItem.requiredQuestions.map((q: QuestionItem, i: number) => {
                          const text = typeof q === 'string' ? q : q?.text;
                          return <li key={i}>{text}</li>;
                        })}
                      </ul>
                    ) : <Text type="secondary">暂无数据</Text>}
                  </div>
                )
              },
              {
                key: 'redFlags',
                label: <span style={{ fontWeight: 600, color: '#cf1322' }}><ExclamationCircleOutlined /> 警惕征象</span>,
                children: (
                  <div style={{ background: '#fff1f0', border: '1px solid #ffa39e', padding: 12, borderRadius: 6 }}>
                    {selectedItem.redFlags?.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {selectedItem.redFlags.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    ) : <Text type="secondary">暂无数据</Text>}
                  </div>
                )
              },
              {
                key: 'assoc',
                label: <span style={{ fontWeight: 600 }}><AppstoreOutlined /> 关联症状</span>,
                children: (
                  <div>
                    {selectedItem.associatedSymptoms?.length > 0 ? (
                      selectedItem.associatedSymptoms.map((s, i) => (
                        <Tag color="blue" key={i} style={{ fontSize: 14, padding: '4px 8px', marginBottom: 8 }}>{s}</Tag>
                      ))
                    ) : <Text type="secondary">暂无数据</Text>}
                  </div>
                )
              },
              {
                key: 'physical',
                label: <span style={{ fontWeight: 600 }}><MedicineBoxOutlined /> 体征提示</span>,
                children: (
                  <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 6 }}>
                    {selectedItem.physicalSigns && selectedItem.physicalSigns.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {selectedItem.physicalSigns.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    ) : <Text type="secondary">暂无数据</Text>}
                  </div>
                )
              },
            ]}
          />
        )}
      </Drawer>
    </div>
  );
};

export default KnowledgeList;
