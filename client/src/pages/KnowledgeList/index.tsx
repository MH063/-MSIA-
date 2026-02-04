import React, { useEffect, useRef, useState } from 'react';
import {
  App as AntdApp,
  Card,
  Typography,
  Tag,
  Input,
  Drawer,
  Space,
  Spin,
  Empty,
  Button,
  Row,
  Col,
  Collapse,
  Segmented,
  Tabs,
  Badge,
  Divider,
  Alert,
  Image,
  Statistic,
  Grid
} from 'antd';
import {
  SearchOutlined,
  BookOutlined,
  MedicineBoxOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  AppstoreOutlined,
  ReloadOutlined,
  FireOutlined,
  StarOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  BookTwoTone
} from '@ant-design/icons';
import api, { unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import { useNavigate, useLocation } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

const { useBreakpoint } = Grid;

type QuestionItem = string | { id: string; text: string; type: string; options?: string[] };

// 症状知识库类型
interface SymptomKnowledgeItem {
  id: number;
  symptomKey: string;
  displayName: string;
  requiredQuestions: QuestionItem[];
  associatedSymptoms: string[];
  redFlags: string[];
  physicalSigns?: string[];
  category?: string;
  priority?: string;
  questions?: string[];
  physicalExamination?: string[];
  differentialPoints?: string[];
  // 扩展字段
  description?: string;
  commonCauses?: string[];
  onsetPatterns?: string[];
  severityScale?: unknown[];
  relatedExams?: string[];
  imageUrl?: string;
  bodySystems?: string[];
  ageGroups?: string[];
  prevalence?: string;
  updatedAt: string;
}

// 疾病百科类型
interface DiseaseEncyclopedia {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  definition: string;
  symptoms: string[];
  redFlags: string[];
  updatedAt: string;
}

// 优先级配置
const PRIORITY_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; label: string; icon: React.ReactNode }> = {
  high: { color: '#ff4d4f', bgColor: '#fff2f0', borderColor: '#ffccc7', label: '高优先级', icon: <FireOutlined /> },
  medium: { color: '#faad14', bgColor: '#fffbe6', borderColor: '#ffe58f', label: '中优先级', icon: <StarOutlined /> },
  low: { color: '#8c8c8c', bgColor: '#f5f5f5', borderColor: '#d9d9d9', label: '低优先级', icon: <InfoCircleOutlined /> }
};

const SYMPTOM_ICON_MAP: Record<string, { emoji: string; bg: string; ring: string }> = {
  fever: { emoji: '🌡️', bg: '#fff2f0', ring: '#ffccc7' },
  cough_and_expectoration: { emoji: '🤧', bg: '#e6f7ff', ring: '#91d5ff' },
  diarrhea: { emoji: '💩', bg: '#fff7e6', ring: '#ffd591' },
  nausea_vomiting: { emoji: '🤮', bg: '#fffbe6', ring: '#ffe58f' },
  dyspnea: { emoji: '🫁', bg: '#f0f5ff', ring: '#adc6ff' },
  vertigo: { emoji: '🌀', bg: '#f9f0ff', ring: '#d3adf7' },
  edema: { emoji: '💧', bg: '#e6fffb', ring: '#87e8de' },
  depression: { emoji: '🧠', bg: '#f5f5f5', ring: '#d9d9d9' },
  hematemesis: { emoji: '🩸', bg: '#fff1f0', ring: '#ffa39e' },
  jaundice: { emoji: '🟡', bg: '#fffbe6', ring: '#ffe58f' },
  lumbodorsalgia: { emoji: '🦴', bg: '#fff7e6', ring: '#ffd591' },
  arthralgia: { emoji: '🦵', bg: '#fff7e6', ring: '#ffd591' },
  dysphagia: { emoji: '🥄', bg: '#f0f5ff', ring: '#adc6ff' },
  hemoptysis: { emoji: '🩸', bg: '#fff1f0', ring: '#ffa39e' },
  urinary_frequency_urgency_dysuria: { emoji: '🚽', bg: '#e6f7ff', ring: '#91d5ff' },
  urinary_incontinence: { emoji: '💧', bg: '#e6fffb', ring: '#87e8de' },
  emaciation: { emoji: '🥀', bg: '#f5f5f5', ring: '#d9d9d9' },
  hematochezia: { emoji: '🩸', bg: '#fff1f0', ring: '#ffa39e' },
  chest_pain: { emoji: '💓', bg: '#fff1f0', ring: '#ffa39e' },
  abdominal_pain: { emoji: '🫃', bg: '#fff7e6', ring: '#ffd591' },
  headache: { emoji: '🤕', bg: '#f0f5ff', ring: '#adc6ff' },
  syncope: { emoji: '😵', bg: '#f5f5f5', ring: '#d9d9d9' },
  palpitation: { emoji: '💗', bg: '#fff1f0', ring: '#ffa39e' },
  constipation: { emoji: '🧱', bg: '#fff7e6', ring: '#ffd591' },
  anxiety: { emoji: '😰', bg: '#f5f5f5', ring: '#d9d9d9' },
  cyanosis: { emoji: '🔵', bg: '#e6f7ff', ring: '#91d5ff' },
  disturbance_of_consciousness: { emoji: '💫', bg: '#f9f0ff', ring: '#d3adf7' },
  dysuria_urinary_retention: { emoji: '🚽', bg: '#e6f7ff', ring: '#91d5ff' },
  hematuria: { emoji: '🩸', bg: '#fff1f0', ring: '#ffa39e' },
  mucosal_hemorrhage: { emoji: '🩸', bg: '#fff1f0', ring: '#ffa39e' },
  obesity: { emoji: '⚖️', bg: '#f5f5f5', ring: '#d9d9d9' },
  oliguria_anuria_polyuria: { emoji: '🚽', bg: '#e6f7ff', ring: '#91d5ff' },
  tic_convulsion: { emoji: '⚡', bg: '#fffbe6', ring: '#ffe58f' },
};

const KnowledgeList: React.FC = () => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const CheckableTag = Tag.CheckableTag;

  // 标签页状态
  const [activeTab, setActiveTab] = useState<'symptoms' | 'diseases'>('symptoms');

  // 症状知识库状态
  const [symptomLoading, setSymptomLoading] = useState(false);
  const [symptomData, setSymptomData] = useState<SymptomKnowledgeItem[]>([]);
  const [symptomKeyToName, setSymptomKeyToName] = useState<Record<string, string>>({});
  const [symptomSearchText, setSymptomSearchText] = useState('');
  const [selectedSymptom, setSelectedSymptom] = useState<SymptomKnowledgeItem | null>(null);
  const [symptomDrawerVisible, setSymptomDrawerVisible] = useState(false);
  const [symptomViewType, setSymptomViewType] = useState<'网格' | '列表'>('网格');
  const [symptomSortMode, setSymptomSortMode] = useState<'默认' | '按首字母' | '按更新时间'>('默认');

  // 疾病百科状态
  const [diseaseLoading, setDiseaseLoading] = useState(false);
  const [diseaseData, setDiseaseData] = useState<DiseaseEncyclopedia[]>([]);
  const [diseaseSearchText, setDiseaseSearchText] = useState('');
  const [selectedDiseaseCategories, setSelectedDiseaseCategories] = useState<string[]>([]);
  const [diseaseViewType, setDiseaseViewType] = useState<'网格' | '列表'>('网格');
  const [selectedDisease, setSelectedDisease] = useState<DiseaseEncyclopedia | null>(null);
  const [diseaseDrawerVisible, setDiseaseDrawerVisible] = useState(false);

  // 统计数据
  const [stats, setStats] = useState({
    symptomCount: 0,
    diseaseCount: 0
  });

  const esRef = useRef<EventSource | null>(null);

  /**
   * 从URL参数初始化
   */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && ['symptoms', 'diseases'].includes(tab)) {
      setActiveTab(tab as 'symptoms' | 'diseases');
    }
    const q = params.get('q');
    if (q) {
      setSymptomSearchText(q);
    }
  }, [location.search]);

  /**
   * 获取症状知识库列表
   */
  const fetchSymptomData = React.useCallback(async () => {
    setSymptomLoading(true);
    try {
      const res: ApiResponse<SymptomKnowledgeItem[]> = await api.get('/knowledge/symptom-mappings');
      const data = unwrapData<SymptomKnowledgeItem[]>(res);
      if (data) {
        setSymptomData(data);
        setStats(prev => ({ ...prev, symptomCount: data.length }));
        console.log('[KnowledgeList] 症状知识库加载成功，共', data.length, '条');
      }
    } catch (error) {
      console.error('[KnowledgeList] 加载症状知识库失败:', error);
      message.error('加载症状知识库失败');
    } finally {
      setSymptomLoading(false);
    }
  }, [message]);

  /**
   * 获取症状中英文映射
   */
  const fetchSymptomNameMapping = React.useCallback(async () => {
    try {
      const res = (await api.get('/mapping/symptoms')) as ApiResponse<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>;
      const payload = unwrapData<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>(res);
      const nameToKey = payload?.nameToKey || {};
      const inverted: Record<string, string> = {};
      for (const [name, key] of Object.entries(nameToKey)) {
        const k = (key || '').trim();
        const n = (name || '').trim();
        if (k && n && !inverted[k]) inverted[k] = n;
      }
      setSymptomKeyToName(inverted);
      console.log('[KnowledgeList] 症状映射加载成功，共', Object.keys(inverted).length, '条');
    } catch (error) {
      console.error('[KnowledgeList] 加载症状映射失败:', error);
    }
  }, []);

  const getSymptomCnName = React.useCallback(
    (item: SymptomKnowledgeItem | null | undefined) => {
      const key = (item?.symptomKey || '').trim();
      const mapped = (symptomKeyToName[key] || '').trim();
      const display = (item?.displayName || '').trim();
      if (mapped) return mapped;
      if (display && key && display.toLowerCase() !== key.toLowerCase()) return display;
      return display || key;
    },
    [symptomKeyToName]
  );

  /**
   * 获取疾病百科列表
   */
  const fetchDiseaseData = React.useCallback(async () => {
    setDiseaseLoading(true);
    try {
      const res: ApiResponse<DiseaseEncyclopedia[]> = await api.get('/knowledge/diseases');
      const data = unwrapData<DiseaseEncyclopedia[]>(res);
      if (data) {
        setDiseaseData(data);
        setStats(prev => ({ ...prev, diseaseCount: data.length }));
        console.log('[KnowledgeList] 疾病百科加载成功，共', data.length, '条');
      }
    } catch (error) {
      console.error('[KnowledgeList] 加载疾病百科失败:', error);
      message.error('加载疾病百科失败');
    } finally {
      setDiseaseLoading(false);
    }
  }, [message]);

  /**
   * 获取疾病详情
   */
  const fetchDiseaseDetail = async (diseaseName: string) => {
    try {
      const res: ApiResponse<DiseaseEncyclopedia> = await api.get(`/knowledge/disease/${encodeURIComponent(diseaseName)}`);
      const data = unwrapData<DiseaseEncyclopedia>(res);
      if (data) {
        setSelectedDisease(data);
        setDiseaseDrawerVisible(true);
      }
    } catch (error) {
      console.error('[KnowledgeList] 获取疾病详情失败:', error);
      message.error('获取疾病详情失败');
    }
  };

  /**
   * 初始化加载所有数据
   */
  useEffect(() => {
    fetchSymptomNameMapping();
    fetchSymptomData();
    fetchDiseaseData();
  }, [fetchSymptomNameMapping, fetchSymptomData, fetchDiseaseData]);

  /**
   * 标签切换时刷新数据
   */
  useEffect(() => {
    if (activeTab === 'symptoms') {
      fetchSymptomNameMapping();
      fetchSymptomData();
    } else if (activeTab === 'diseases') {
      fetchDiseaseData();
    }
  }, [activeTab, fetchDiseaseData, fetchSymptomData, fetchSymptomNameMapping]);

  /**
   * 构建 SSE 连接地址
   */
  const buildSseUrl = (): string => {
    const base = api.defaults.baseURL || '';
    const url = (() => {
      if (!base) return '/api/knowledge/stream';
      const root = base.endsWith('/api') ? base.slice(0, -4) : base;
      return `${root}/api/knowledge/stream`;
    })();

    const token = (() => {
      try {
        return (
          window.localStorage.getItem('OPERATOR_TOKEN') ||
          window.localStorage.getItem('AUTH_TOKEN') ||
          window.localStorage.getItem('TOKEN') ||
          ''
        );
      } catch {
        return '';
      }
    })();

    const t = String(token || '').trim();
    if (!t) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(t)}`;
  };

  useEffect(() => {
    const url = buildSseUrl();
    console.log('[KnowledgeList] 建立SSE连接', { url: url.replace(/token=[^&]+/iu, 'token=***') });
    const es = new EventSource(url);
    es.onmessage = () => {
      fetchSymptomNameMapping();
      fetchSymptomData();
      fetchDiseaseData();
    };
    es.addEventListener('knowledge_updated', () => {
      fetchSymptomNameMapping();
      fetchSymptomData();
      fetchDiseaseData();
    });
    es.onerror = (evt) => {
      console.warn('[KnowledgeList] SSE连接异常', evt);
    };
    esRef.current = es;
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [fetchSymptomData, fetchDiseaseData, fetchSymptomNameMapping]);

  /**
   * 按首字母分组
   */
  const groupByLetter = (items: SymptomKnowledgeItem[]) => {
    const groups: Record<string, SymptomKnowledgeItem[]> = {};
    items.forEach(it => {
      const first = (it.symptomKey?.[0] || '#').toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(it);
    });
    return Object.keys(groups).sort().map(k => ({
      key: k,
      label: k,
      items: groups[k].slice().sort((a, b) => (a.symptomKey || '').localeCompare(b.symptomKey || ''))
    }));
  };

  /**
   * 按更新时间分组
   */
  const groupByUpdated = (items: SymptomKnowledgeItem[]) => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const groups: { key: string; label: string; items: SymptomKnowledgeItem[] }[] = [
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
    return groups
      .filter(g => g.items.length > 0)
      .map(g => ({
        ...g,
        items: g.items.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      }));
  };

  const getSymptomIcon = (symptomKey: string | undefined) => {
    const key = (symptomKey || '').trim();
    return SYMPTOM_ICON_MAP[key] || { emoji: '🩺', bg: '#f0f5ff', ring: '#adc6ff' };
  };

  /**
   * getBodySystemIcon
   * 根据文本推断所属系统并返回展示图标与配色
   */
  const getBodySystemIcon = (text: string | undefined) => {
    const s = (text || '').trim();
    const pick = (emoji: string, bg: string, ring: string) => ({ emoji, bg, ring });
    if (s.includes('运动系统') || s.includes('运动') || s.includes('骨') || s.includes('肌肉') || s.includes('关节')) return pick('🏃', '#f6ffed', '#b7eb8f');
    if (s.includes('消化系统') || s.includes('消化') || s.includes('胃') || s.includes('肠') || s.includes('肝') || s.includes('胆')) return pick('🍽️', '#fff7e6', '#ffd591');
    if (s.includes('呼吸系统') || s.includes('呼吸')) return pick('👃', '#e6f7ff', '#91d5ff');
    if (s.includes('泌尿系统') || s.includes('泌尿') || s.includes('肾')) return pick('💧', '#e6fffb', '#87e8de');
    if (s.includes('生殖系统') || s.includes('生殖') || s.includes('妇产') || s.includes('男科') || s.includes('妊娠')) return pick('♀️♂️', '#fff0f6', '#ffadd2');
    if (s.includes('心血管系统') || s.includes('循环') || s.includes('心血管') || s.includes('心脏')) return pick('🩸', '#fff1f0', '#ffccc7');
    if (s.includes('神经系统') || s.includes('神经') || s.includes('脑')) return pick('🧠', '#f9f0ff', '#d3adf7');
    if (s.includes('内分泌系统') || s.includes('内分泌') || s.includes('代谢')) return pick('⚖️', '#fffbe6', '#ffe58f');
    if (s.includes('免疫系统') || s.includes('免疫')) return pick('🛡️', '#e6fffb', '#87e8de');
    return pick('📄', '#f0f5ff', '#adc6ff');
  };

  const getDiseaseSystemIcon = (disease: DiseaseEncyclopedia | null | undefined) => {
    const text = [
      disease?.category,
      disease?.name,
      disease?.definition,
      ...(disease?.symptoms || [])
    ]
      .filter(Boolean)
      .join(' ');
    return getBodySystemIcon(text);
  };

  /**
   * 渲染症状知识库卡片
   */
  const renderSymptomCard = (item: SymptomKnowledgeItem) => {
    const priorityConfig = PRIORITY_CONFIG[item.priority || 'medium'];
    const icon = getSymptomIcon(item.symptomKey);
    const cnName = getSymptomCnName(item);
    const enName = (item.symptomKey || '').trim();
    const showEn = Boolean(cnName && enName && cnName.trim().toLowerCase() !== enName.toLowerCase());
    const showPriorityTag = (item.priority || 'medium') !== 'medium';
    return (
      <Col key={item.id} xs={24} sm={12} md={8} lg={6} xl={6} xxl={4}>
        <Card
          hoverable
          onClick={() => {
            setSelectedSymptom(item);
            setSymptomDrawerVisible(true);
          }}
          className="msia-card"
          style={{ borderTop: `3px solid ${priorityConfig.color}` }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              className="msia-icon-pill"
              style={{
                background: icon.bg,
                borderColor: icon.ring,
                flex: '0 0 auto'
              }}
              aria-label={`${cnName} 图标`}
            >
              {icon.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <Title level={5} style={{ margin: 0, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cnName}
                  </Title>
                  {showEn ? (
                    <Text className="msia-muted" style={{ fontSize: 12, display: 'block' }}>
                      {enName}
                    </Text>
                  ) : null}
                </div>
                {showPriorityTag ? (
                  <Tag className="msia-tag" color={priorityConfig.color} style={{ fontSize: 11, marginInlineEnd: 0 }}>
                    {priorityConfig.icon} {priorityConfig.label}
                  </Tag>
                ) : null}
              </div>
              {item.description ? (
                <Paragraph ellipsis={{ rows: 2 }} style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(0, 0, 0, 0.55)' }}>
                  {item.description}
                </Paragraph>
              ) : null}
            </div>
          </div>
        </Card>
      </Col>
    );
  };

  const renderSymptomListItem = (item: SymptomKnowledgeItem) => {
    const priorityConfig = PRIORITY_CONFIG[item.priority || 'medium'];
    const icon = getSymptomIcon(item.symptomKey);
    const cnName = getSymptomCnName(item);
    const enName = (item.symptomKey || '').trim();
    const showEn = Boolean(cnName && enName && cnName.trim().toLowerCase() !== enName.toLowerCase());
    const showPriorityTag = (item.priority || 'medium') !== 'medium';
    return (
      <Card
        key={item.id}
        hoverable
        className="msia-card"
        style={{ borderLeft: `4px solid ${priorityConfig.color}` }}
        onClick={() => {
          setSelectedSymptom(item);
          setSymptomDrawerVisible(true);
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            className="msia-icon-pill"
            style={{
              background: icon.bg,
              borderColor: icon.ring,
              flex: '0 0 auto'
            }}
            aria-label={`${cnName} 图标`}
          >
            {icon.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <Text strong style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {cnName}
                </Text>
                {showEn ? (
                  <Text className="msia-muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', marginTop: 2 }}>
                    {enName}
                  </Text>
                ) : null}
              </div>
              {showPriorityTag ? (
                <Tag className="msia-tag" color={priorityConfig.color} style={{ fontSize: 11, marginInlineEnd: 0 }}>
                  {priorityConfig.icon} {priorityConfig.label}
                </Tag>
              ) : null}
            </div>
            {item.description ? (
              <Paragraph ellipsis={{ rows: 2 }} style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(0, 0, 0, 0.55)' }}>
                {item.description}
              </Paragraph>
            ) : null}
          </div>
        </div>
      </Card>
    );
  };

  /**
   * 渲染症状知识库内容
   */
  const renderSymptomContent = () => {
    const keyword = symptomSearchText.trim().toLowerCase();
    const filteredByKeyword = keyword
      ? symptomData.filter((it) => {
          const name = (getSymptomCnName(it) || '').toLowerCase();
          const key = (it.symptomKey || '').toLowerCase();
          const desc = (it.description || '').toLowerCase();
          return name.includes(keyword) || key.includes(keyword) || desc.includes(keyword);
        })
      : symptomData;

    const filteredData = filteredByKeyword;

    const sortedData =
      symptomSortMode === '按更新时间'
        ? filteredData.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        : symptomSortMode === '按首字母'
          ? filteredData.slice().sort((a, b) => (a.symptomKey || '').localeCompare(b.symptomKey || ''))
          : filteredData;

    return (
      <div>
        {/* 搜索和筛选 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12} lg={8}>
            <Input
              placeholder="搜索症状名称、关键词..."
              prefix={<SearchOutlined />}
              value={symptomSearchText}
              onChange={e => setSymptomSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={12} lg={16}>
            <Space wrap>
              <Text type="secondary">视图:</Text>
              <Segmented
                options={['网格', '列表']}
                value={symptomViewType}
                onChange={(val) => {
                  const next = val as '网格' | '列表';
                  console.log('[KnowledgeList] 视图切换:', next);
                  setSymptomViewType(next);
                }}
                size="small"
              />
              <Text type="secondary">排序:</Text>
              <Segmented
                options={['默认', '按首字母', '按更新时间']}
                value={symptomSortMode}
                onChange={(val) => {
                  const next = val as '默认' | '按首字母' | '按更新时间';
                  console.log('[KnowledgeList] 排序切换:', next);
                  setSymptomSortMode(next);
                }}
                size="small"
              />
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => {
                  fetchSymptomNameMapping();
                  fetchSymptomData();
                }}
                loading={symptomLoading}
                className="msia-action-button"
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>

        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <Space wrap size={[8, 8]}>
            <Text type="secondary">显示</Text>
            <Text strong style={{ fontSize: 16 }}>{sortedData.length}</Text>
            <Text type="secondary">/ {symptomData.length}</Text>
            {keyword ? (
              <Tag className="msia-tag" color="blue" style={{ marginInlineEnd: 0 }}>
                关键词：{symptomSearchText.trim()}
              </Tag>
            ) : null}
          </Space>
          {keyword ? (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setSymptomSearchText('');
              }}
            >
              清空条件
            </Button>
          ) : null}
        </div>

        {/* 症状列表 */}
        <Spin spinning={symptomLoading}>
          {sortedData.length > 0 ? (
            symptomSortMode === '按首字母' || symptomSortMode === '按更新时间' ? (
              <>
                {(symptomSortMode === '按首字母' ? groupByLetter(sortedData) : groupByUpdated(sortedData)).map(group => (
                  <div key={group.key} style={{ marginBottom: 16 }}>
                    <Title level={5} style={{ margin: '0 0 12px', padding: '10px 12px', background: '#ffffff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
                      {group.label}（{group.items.length}）
                    </Title>
                    {symptomViewType === '网格' ? (
                      <Row gutter={[16, 16]}>
                        {group.items.map(renderSymptomCard)}
                      </Row>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {group.items.map(renderSymptomListItem)}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : symptomViewType === '网格' ? (
              <Row gutter={[16, 16]}>
                {sortedData.map(renderSymptomCard)}
              </Row>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sortedData.map(renderSymptomListItem)}
              </div>
            )
          ) : (
            <Empty description="暂无相关症状知识" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button
                type="primary"
                className="msia-action-button"
                onClick={() => {
                  setSymptomSearchText('');
                }}
              >
                清除筛选
              </Button>
            </Empty>
          )}
        </Spin>
      </div>
    );
  };

  /**
   * 渲染疾病百科内容
   */
  const renderDiseaseContent = () => {
    const keyword = diseaseSearchText.trim().toLowerCase();
    const filteredByKeyword = keyword
      ? diseaseData.filter(d =>
          d.name.toLowerCase().includes(keyword) ||
          d.aliases?.some(alias => alias.toLowerCase().includes(keyword))
        )
      : diseaseData;

    const categories = Array.from(new Set(diseaseData.map(d => d.category)));
    const filteredDiseases =
      selectedDiseaseCategories.length > 0
        ? filteredByKeyword.filter((d) => selectedDiseaseCategories.includes(d.category))
        : filteredByKeyword;

    return (
      <div>
        {/* 搜索和筛选 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12} lg={8}>
            <Input
              placeholder="搜索疾病名称、别名..."
              prefix={<SearchOutlined />}
              value={diseaseSearchText}
              onChange={e => setDiseaseSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={12} lg={16}>
            <div className="msia-filter-panel">
              <Space wrap size={[8, 8]}>
                <Text type="secondary">分类筛选:</Text>
                <CheckableTag
                  className="msia-tag"
                  checked={selectedDiseaseCategories.length === 0}
                  onChange={(checked) => {
                    if (checked) {
                      console.log('[KnowledgeList] 疾病分类筛选: 全部');
                      setSelectedDiseaseCategories([]);
                    }
                  }}
                >
                  全部
                </CheckableTag>
                {categories.map((cat) => (
                  <CheckableTag
                    key={cat}
                    className="msia-tag"
                    checked={selectedDiseaseCategories.includes(cat)}
                    onChange={(checked) => {
                      setSelectedDiseaseCategories((prev) => {
                        const next = checked ? Array.from(new Set([...prev, cat])) : prev.filter((x) => x !== cat);
                        console.log('[KnowledgeList] 疾病分类筛选:', next.length ? next : ['全部']);
                        return next;
                      });
                    }}
                  >
                    {cat}
                  </CheckableTag>
                ))}
                <Text type="secondary">视图:</Text>
                <Segmented
                  options={['网格', '列表']}
                  value={diseaseViewType}
                  onChange={(val) => {
                    const next = val as '网格' | '列表';
                    console.log('[KnowledgeList] 疾病视图切换:', next);
                    setDiseaseViewType(next);
                  }}
                  size="small"
                />
                <Button icon={<ReloadOutlined />} size="small" onClick={fetchDiseaseData} loading={diseaseLoading} className="msia-action-button">
                  刷新
                </Button>
              </Space>
            </div>
          </Col>
        </Row>

        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <Space wrap size={[8, 8]}>
            <Text type="secondary">显示</Text>
            <Text strong style={{ fontSize: 16 }}>{filteredDiseases.length}</Text>
            <Text type="secondary">/ {diseaseData.length}</Text>
            {keyword ? (
              <Tag className="msia-tag" color="blue" style={{ marginInlineEnd: 0 }}>
                关键词：{diseaseSearchText.trim()}
              </Tag>
            ) : null}
            {selectedDiseaseCategories.map((cat) => (
              <Tag
                key={cat}
                className="msia-tag"
                closable
                onClose={(e) => {
                  e.preventDefault();
                  setSelectedDiseaseCategories((prev) => prev.filter((x) => x !== cat));
                }}
                style={{ marginInlineEnd: 0 }}
              >
                {cat}
              </Tag>
            ))}
          </Space>
          {(keyword || selectedDiseaseCategories.length > 0) ? (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setDiseaseSearchText('');
                setSelectedDiseaseCategories([]);
              }}
            >
              清空条件
            </Button>
          ) : null}
        </div>

        {/* 疾病列表 */}
        <Spin spinning={diseaseLoading}>
          {filteredDiseases.length > 0 ? (
            diseaseViewType === '网格' ? (
              <Row gutter={[16, 16]}>
                {filteredDiseases.map((disease) => (
                  <Col key={disease.id} xs={24} md={screens.md ? 12 : 24}>
                    <Card
                      hoverable
                      onClick={() => {
                        console.log('[KnowledgeList] 打开疾病详情:', disease.name);
                        fetchDiseaseDetail(disease.name);
                      }}
                      className="msia-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div
                          className="msia-icon-pill"
                          style={{
                            background: getDiseaseSystemIcon(disease).bg,
                            borderColor: getDiseaseSystemIcon(disease).ring,
                            flex: '0 0 auto'
                          }}
                        >
                          {getDiseaseSystemIcon(disease).emoji}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <Text strong style={{ fontSize: 15, display: 'block' }}>{disease.name}</Text>
                              <Space size="small" wrap style={{ marginTop: 6 }}>
                                <Tag color="purple" className="msia-tag" style={{ marginInlineEnd: 0 }}>{disease.category}</Tag>
                                {disease.updatedAt ? (
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    <ClockCircleOutlined /> {new Date(disease.updatedAt).toLocaleDateString()}
                                  </Text>
                                ) : null}
                              </Space>
                            </div>
                            <BookTwoTone twoToneColor="#722ed1" style={{ fontSize: 20, flex: '0 0 auto' }} />
                          </div>
                          <Paragraph ellipsis={{ rows: 2 }} style={{ color: 'rgba(0, 0, 0, 0.55)', margin: '10px 0 0', fontSize: 13 }}>
                            {disease.definition}
                          </Paragraph>
                          {disease.aliases && disease.aliases.length > 0 ? (
                            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>别名</Text>
                              {disease.aliases.slice(0, 3).map((alias, idx) => (
                                <Tag key={idx} className="msia-tag" style={{ fontSize: 11, padding: '0 10px', marginInlineEnd: 0 }}>{alias}</Tag>
                              ))}
                              {disease.aliases.length > 3 ? (
                                <Tag className="msia-tag" style={{ fontSize: 11, padding: '0 10px', marginInlineEnd: 0 }}>
                                  +{disease.aliases.length - 3}
                                </Tag>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredDiseases.map((disease) => (
                  <Card
                    key={disease.id}
                    hoverable
                    onClick={() => {
                      console.log('[KnowledgeList] 打开疾病详情:', disease.name);
                      fetchDiseaseDetail(disease.name);
                    }}
                    className="msia-card"
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div
                        className="msia-icon-pill"
                        style={{
                          background: getDiseaseSystemIcon(disease).bg,
                          borderColor: getDiseaseSystemIcon(disease).ring,
                          flex: '0 0 auto'
                        }}
                      >
                        {getDiseaseSystemIcon(disease).emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <Text strong style={{ fontSize: 15, display: 'block' }}>{disease.name}</Text>
                            <Space size="small" wrap style={{ marginTop: 6 }}>
                              <Tag color="purple" className="msia-tag" style={{ marginInlineEnd: 0 }}>{disease.category}</Tag>
                              {disease.updatedAt ? (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  <ClockCircleOutlined /> {new Date(disease.updatedAt).toLocaleDateString()}
                                </Text>
                              ) : null}
                            </Space>
                          </div>
                          <BookTwoTone twoToneColor="#722ed1" style={{ fontSize: 20, flex: '0 0 auto' }} />
                        </div>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ color: 'rgba(0, 0, 0, 0.55)', margin: '10px 0 0', fontSize: 13 }}>
                          {disease.definition}
                        </Paragraph>
                        {disease.aliases && disease.aliases.length > 0 ? (
                          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>别名</Text>
                            {disease.aliases.slice(0, 3).map((alias, idx) => (
                              <Tag key={idx} className="msia-tag" style={{ fontSize: 11, padding: '0 10px', marginInlineEnd: 0 }}>{alias}</Tag>
                            ))}
                            {disease.aliases.length > 3 ? (
                              <Tag className="msia-tag" style={{ fontSize: 11, padding: '0 10px', marginInlineEnd: 0 }}>
                                +{disease.aliases.length - 3}
                              </Tag>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <Empty description="暂无相关疾病信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Spin>
      </div>
    );
  };

  return (
    <div className="msia-page">
      {/* 页面标题 */}
      <Card className="msia-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              <BookOutlined style={{ color: '#1890ff', marginRight: 8 }} />
              医学知识库
            </Title>
            <Text type="secondary">全面的医学知识查询平台，包含症状、疾病百科</Text>
          </div>
          <div className="msia-kpi-row">
            <div className="msia-kpi">
              <Statistic title="症状知识" value={stats.symptomCount} prefix={<MedicineBoxOutlined />} styles={{ content: { color: '#1890ff' } }} />
            </div>
            <div className="msia-kpi">
              <Statistic title="疾病百科" value={stats.diseaseCount} prefix={<BookOutlined />} styles={{ content: { color: '#722ed1' } }} />
            </div>
          </div>
        </div>
      </Card>

      {/* 主内容区 */}
      <Card className="msia-card">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as 'symptoms' | 'diseases');
            navigate(`/knowledge?tab=${key}`, { replace: true });
          }}
          type="card"
          size="large"
          items={[
            {
              key: 'symptoms',
              label: (
                <span>
                  <MedicineBoxOutlined /> 症状知识库
                  <Badge count={stats.symptomCount} style={{ marginLeft: 8, backgroundColor: '#1890ff' }} />
                </span>
              ),
              children: renderSymptomContent()
            },
            {
              key: 'diseases',
              label: (
                <span>
                  <BookOutlined /> 疾病百科
                  <Badge count={stats.diseaseCount} style={{ marginLeft: 8, backgroundColor: '#722ed1' }} />
                </span>
              ),
              children: renderDiseaseContent()
            }
          ]}
        />
      </Card>

      {/* 症状详情抽屉 */}
      <Drawer
        title={
          selectedSymptom ? (
            <Space size={10} align="start">
              <span
                className="msia-icon-pill"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 12,
                  fontSize: 18,
                  background: getSymptomIcon(selectedSymptom.symptomKey).bg,
                  borderColor: getSymptomIcon(selectedSymptom.symptomKey).ring
                }}
              >
                {getSymptomIcon(selectedSymptom.symptomKey).emoji}
              </span>
              <div style={{ lineHeight: 1.2 }}>
                <div>{getSymptomCnName(selectedSymptom) || selectedSymptom.symptomKey}</div>
                {(() => {
                  const cn = (getSymptomCnName(selectedSymptom) || '').trim();
                  const en = (selectedSymptom.symptomKey || '').trim();
                  const showEn = Boolean(cn && en && cn.toLowerCase() !== en.toLowerCase());
                  return showEn ? <Text type="secondary" style={{ fontSize: 12 }}>{en}</Text> : null;
                })()}
              </div>
            </Space>
          ) : (
            '症状详情'
          )
        }
        placement="right"
        size="large"
        onClose={() => setSymptomDrawerVisible(false)}
        open={symptomDrawerVisible}
      >
        {selectedSymptom && (
          <div>
            {/* 症状图片 */}
            {selectedSymptom.imageUrl ? (
              <Image
                src={selectedSymptom.imageUrl}
                alt={getSymptomCnName(selectedSymptom) || selectedSymptom.symptomKey}
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 14, marginBottom: 16 }}
                fallback="https://picsum.photos/400/200?random=medical"
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 160,
                  background: getSymptomIcon(selectedSymptom.symptomKey).bg,
                  border: `1px solid ${getSymptomIcon(selectedSymptom.symptomKey).ring}`,
                  borderRadius: 14,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ fontSize: 64, lineHeight: 1 }}>{getSymptomIcon(selectedSymptom.symptomKey).emoji}</span>
              </div>
            )}

            {/* 基本信息 */}
            <Card size="small" className="msia-card" style={{ marginBottom: 16 }}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <div><Text strong>症状键值:</Text> <Tag className="msia-tag">{selectedSymptom.symptomKey}</Tag></div>
                {selectedSymptom.bodySystems && selectedSymptom.bodySystems.length > 0 && (
                  <div>
                    <Text strong>所属系统:</Text>
                    {selectedSymptom.bodySystems.map((system, idx) => (
                      <Tag key={idx} className="msia-tag" style={{ fontSize: 11, padding: '0 10px' }}>{system}</Tag>
                    ))}
                  </div>
                )}
              </Space>
            </Card>

            {/* 症状描述 */}
            {selectedSymptom.description && (
              <Alert
                title="症状描述"
                description={selectedSymptom.description}
                type="info"
                style={{ marginBottom: 16 }}
                showIcon
              />
            )}

            <Collapse
              defaultActiveKey={['questions', 'redFlags']}
              ghost
              items={[
                {
                  key: 'questions',
                  label: (
                    <span style={{ fontWeight: 600 }}>
                      <QuestionCircleOutlined /> 必问问题 ({selectedSymptom.questions?.length || 0})
                    </span>
                  ),
                  children: (
                    <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6 }}>
                      {selectedSymptom.questions && selectedSymptom.questions.length > 0 ? (
                        <ol style={{ margin: 0, paddingLeft: 20 }}>
                          {selectedSymptom.questions.map((q, i) => (
                            <li key={i} style={{ marginBottom: 8 }}>{q}</li>
                          ))}
                        </ol>
                      ) : <Text type="secondary">暂无数据</Text>}
                    </div>
                  )
                },
                {
                  key: 'redFlags',
                  label: (
                    <span style={{ fontWeight: 600, color: '#cf1322' }}>
                      <ExclamationCircleOutlined /> 警惕征象 ({selectedSymptom.redFlags?.length || 0})
                    </span>
                  ),
                  children: (
                    <div style={{ background: '#fff1f0', border: '1px solid #ffa39e', padding: 12, borderRadius: 6 }}>
                      {selectedSymptom.redFlags && selectedSymptom.redFlags.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 20, color: '#cf1322' }}>
                          {selectedSymptom.redFlags.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      ) : <Text type="secondary">暂无数据</Text>}
                    </div>
                  )
                },
                {
                  key: 'physical',
                  label: (
                    <span style={{ fontWeight: 600 }}>
                      <MedicineBoxOutlined /> 体格检查要点 ({selectedSymptom.physicalExamination?.length || 0})
                    </span>
                  ),
                  children: (
                    <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 6 }}>
                      {selectedSymptom.physicalExamination && selectedSymptom.physicalExamination.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {selectedSymptom.physicalExamination.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      ) : <Text type="secondary">暂无数据</Text>}
                    </div>
                  )
                },
                {
                  key: 'differential',
                  label: (
                    <span style={{ fontWeight: 600 }}>
                      <CheckCircleOutlined /> 鉴别诊断要点 ({selectedSymptom.differentialPoints?.length || 0})
                    </span>
                  ),
                  children: (
                    <div style={{ background: '#f9f0ff', padding: 12, borderRadius: 6 }}>
                      {selectedSymptom.differentialPoints && selectedSymptom.differentialPoints.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {selectedSymptom.differentialPoints.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      ) : <Text type="secondary">暂无数据</Text>}
                    </div>
                  )
                },
                ...(selectedSymptom.commonCauses && selectedSymptom.commonCauses.length > 0 ? [{
                  key: 'causes',
                  label: (
                    <span style={{ fontWeight: 600 }}>
                      <FireOutlined /> 常见病因 ({selectedSymptom.commonCauses.length})
                    </span>
                  ),
                  children: (
                    <div style={{ background: '#fffbe6', padding: 12, borderRadius: 6 }}>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {selectedSymptom.commonCauses.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )
                }] : []),
                ...(selectedSymptom.relatedExams && selectedSymptom.relatedExams.length > 0 ? [{
                  key: 'exams',
                  label: (
                    <span style={{ fontWeight: 600 }}>
                      <ExperimentOutlined /> 相关检查 ({selectedSymptom.relatedExams.length})
                    </span>
                  ),
                  children: (
                    <div style={{ background: '#f6ffed', padding: 12, borderRadius: 6 }}>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {selectedSymptom.relatedExams.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )
                }] : []),
                {
                  key: 'assoc',
                  label: (
                    <span style={{ fontWeight: 600 }}>
                      <AppstoreOutlined /> 关联症状 ({selectedSymptom.associatedSymptoms?.length || 0})
                    </span>
                  ),
                  children: (
                    <div>
                      {selectedSymptom.associatedSymptoms && selectedSymptom.associatedSymptoms.length > 0 ? (
                        selectedSymptom.associatedSymptoms.map((s, i) => (
                          <Tag color="blue" key={i} style={{ fontSize: 14, padding: '4px 8px', marginBottom: 8 }}>{s}</Tag>
                        ))
                      ) : <Text type="secondary">暂无数据</Text>}
                    </div>
                  )
                }
              ]}
            />

            <Divider />

            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined /> 更新时间: {new Date(selectedSymptom.updatedAt).toLocaleString()}
            </Text>
          </div>
        )}
      </Drawer>

      {/* 疾病详情抽屉 */}
      <Drawer
        title={
          selectedDisease ? (
            <Space size={10}>
              <span
                className="msia-icon-pill"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 12,
                  fontSize: 18,
                  background: getDiseaseSystemIcon(selectedDisease).bg,
                  borderColor: getDiseaseSystemIcon(selectedDisease).ring
                }}
              >
                {getDiseaseSystemIcon(selectedDisease).emoji}
              </span>
              <span>{selectedDisease.name}</span>
            </Space>
          ) : (
            '疾病详情'
          )
        }
        placement="right"
        size="large"
        onClose={() => setDiseaseDrawerVisible(false)}
        open={diseaseDrawerVisible}
      >
        {selectedDisease && (
          <div>
            <div
              style={{
                width: '100%',
                height: 160,
                background: getDiseaseSystemIcon(selectedDisease).bg,
                border: `1px solid ${getDiseaseSystemIcon(selectedDisease).ring}`,
                borderRadius: 14,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: 64, lineHeight: 1 }}>{getDiseaseSystemIcon(selectedDisease).emoji}</span>
            </div>

            <Card size="small" className="msia-card" style={{ marginBottom: 16 }}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <div><Text strong>分类:</Text> <Tag color="purple" className="msia-tag">{selectedDisease.category}</Tag></div>
                {selectedDisease.aliases && selectedDisease.aliases.length > 0 ? (
                  <div>
                    <Text strong>别名:</Text>
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {selectedDisease.aliases.map((alias, idx) => (
                        <Tag key={idx} className="msia-tag" style={{ marginInlineEnd: 0 }}>{alias}</Tag>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Space>
            </Card>

            <Alert
              title="疾病定义"
              description={selectedDisease.definition}
              type="info"
              style={{ marginBottom: 16 }}
              showIcon
            />

            {selectedDisease.symptoms && selectedDisease.symptoms.length > 0 ? (
              <Card
                size="small"
                className="msia-card"
                title={<span style={{ fontWeight: 600 }}><InfoCircleOutlined /> 相关症状 ({selectedDisease.symptoms.length})</span>}
                style={{ marginBottom: 16 }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedDisease.symptoms.map((symptom, idx) => (
                    <Tag key={idx} color="blue" className="msia-tag" style={{ marginInlineEnd: 0 }}>{symptom}</Tag>
                  ))}
                </div>
              </Card>
            ) : null}

            {selectedDisease.redFlags && selectedDisease.redFlags.length > 0 ? (
              <Alert
                title="警惕征象"
                description={
                  <div style={{ background: '#fff1f0', border: '1px solid #ffa39e', padding: 12, borderRadius: 8 }}>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#cf1322' }}>
                      {selectedDisease.redFlags.map((flag, idx) => <li key={idx}>{flag}</li>)}
                    </ul>
                  </div>
                }
                type="error"
                style={{ marginBottom: 16 }}
                showIcon
              />
            ) : null}

            <Divider />

            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined /> 更新时间: {new Date(selectedDisease.updatedAt).toLocaleString()}
            </Text>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default KnowledgeList;
