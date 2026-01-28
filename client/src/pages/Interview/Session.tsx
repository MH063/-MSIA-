import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, message, Spin, Modal, Button } from 'antd';
import dayjs from 'dayjs';
import api, { type ApiResponse, unwrapData } from '../../utils/api';

import InterviewLayout from './components/Layout/InterviewLayout';
import NavigationPanel from './components/Navigation/NavigationPanel';
import type { SectionStatus } from './components/Navigation/NavigationPanel';
import EditorPanel from './components/Editor/EditorPanel';
import KnowledgePanel from './components/Knowledge/KnowledgePanel';
import AssistantOverlay from './components/Assistant/AssistantOverlay';
import { useAssistantStore, type ModuleKey } from '../../store/assistant.store';

interface KnowledgeItem {
  id: number;
  symptomKey: string;
  displayName: string;
  requiredQuestions: string[];
  associatedSymptoms: string[];
  redFlags: string[];
  physicalSigns?: string[];
  updatedAt?: string;
}

interface SymptomContext {
  name: string;
  questions: string[];
  relatedSymptoms: string[];
  redFlags: string[];
  physicalSigns: string[];
  updatedAt?: string;
}

interface FormValues {
  name?: string;
  gender?: string;
  age?: number;
  birthDate?: unknown;
  chiefComplaint?: { text?: string; symptom?: string };
  presentIllness?: {
    onsetMode?: string;
    onsetTime?: string;
    trigger?: string;
    location?: string;
    quality?: string[];
    severity?: string;
    durationDetails?: string;
    factors?: string;
    treatmentHistory?: string;
    associatedSymptoms?: string[];
  };
  pastHistory?: {
    pmh_diseases?: string[];
    pmh_trauma_surgery?: string;
    pmh_allergies?: string;
    hasAllergy?: 'yes' | 'no';
    pmh_infectious?: string;
    pmh_other?: string;
    confirmedSymptoms?: string[];
  };
  personalHistory?: {
    smoking_status?: string;
    alcohol_status?: string;
  };
  maritalHistory?: {
    status?: string;
  };
  menstrualHistory?: {
    age?: number;
    lmp?: string;
    menopause_age?: number;
  };
  fertilityHistory?: {
    summary?: string;
  };
  familyHistory?: {
    father?: string;
    mother?: string;
    genetic_diseases?: string[];
    deceased?: string;
    other?: string;
  };
  reviewOfSystems?: Record<string, { symptoms?: string[]; details?: string }>;
}

type SymptomPrompt = {
  questions: string[];
  relatedSymptoms: string[];
  redFlags: string[];
  physicalSigns?: string[];
};

const symptomPrompts: Record<string, SymptomPrompt> = {
  // 通用兜底
  "general": {
    questions: [
      "症状的起因？",
      "持续时间？",
      "加重/缓解因素？",
      "是否影响日常活动？"
    ],
    relatedSymptoms: [],
    redFlags: [],
    physicalSigns: []
  }
};

// 现病史伴随症状键值映射（模块级常量，避免 React Hooks 依赖抖动）
const HPI_ASSOCIATED_MAP: Record<string, string> = {
  fever: "发热",
  chills: "畏寒",
  sweating: "出汗",
  weight_loss: "消瘦（体重下降）",
  nausea: "恶心与呕吐",
  diarrhea: "腹泻",
  cough: "咳嗽",
  sputum: "咳痰",
  chest_pain: "胸痛",
  hematemesis: "上消化道出血", // 映射呕血
  melena: "上消化道出血", // 映射黑便
  hemoptysis: "咯血",
  dizziness: "眩晕"
};

// 现病史伴随症状的中文名到键值映射（用于自动解析主诉文本时同步 presentIllness.associatedSymptoms）
const NAME_TO_HPI_KEY: Record<string, string> = {
  "发热": "fever",
  "恶心呕吐": "nausea",
  "腹泻": "diarrhea",
  "咳嗽": "cough",
  "咳痰": "sputum",
  "胸痛": "chest_pain",
  "眩晕": "dizziness",
  "咯血": "hemoptysis",
  "上消化道出血": "hematemesis"
};

// 症状到系统映射（用于限制自动勾选仅限主诉系统）
const SYMPTOM_TO_SYSTEM: Record<string, string> = {
  '咳嗽': 'respiratory',
  '咳痰': 'respiratory',
  '咯血': 'respiratory',
  '胸痛': 'respiratory',
  '呼吸困难': 'respiratory',
  '发热': 'respiratory',
  '盗汗': 'respiratory',
  '恶心': 'digestive',
  '呕吐': 'digestive',
  '恶心呕吐': 'digestive',
  '腹痛': 'digestive',
  '腹胀': 'digestive',
  '腹泻': 'digestive',
  '便秘': 'digestive',
  '呕血': 'digestive',
  '黑便': 'digestive',
  '黄疸': 'digestive',
  '心悸': 'cardiovascular',
  '胸闷': 'cardiovascular',
  '水肿': 'cardiovascular',
  '晕厥': 'cardiovascular',
  '气短': 'cardiovascular',
  '头痛': 'neurological',
  '眩晕': 'neurological'
};

const SECTIONS = [
  { key: 'general', label: '一般项目' },
  { key: 'chief_complaint', label: '主诉' },
  { key: 'hpi', label: '现病史' },
  { key: 'past_history', label: '既往史' },
  { key: 'personal_history', label: '个人史' },
  { key: 'marital_history', label: '婚育史' },
  { key: 'family_history', label: '家族史' },
  { key: 'review_of_systems', label: '系统回顾' },
];

const KNOWLEDGE_TTL_MS = 60 * 1000;
const knowledgeCache = new Map<string, { item: KnowledgeItem; fetchedAt: number }>();
const pendingRequests = new Map<string, Promise<KnowledgeItem | null>>();
const versionNotifiedKeys = new Set<string>();

async function fetchKnowledgeFromAPI(symptomKey: string): Promise<KnowledgeItem | null> {
  try {
    const response: ApiResponse<KnowledgeItem> = await api.get(`/knowledge/${symptomKey}`);
    if (response.success && response.data) {
      const data = response.data as KnowledgeItem;
      knowledgeCache.set(symptomKey, { item: data, fetchedAt: Date.now() });
      console.log(`[Session] 知识库缓存更新: ${symptomKey}`, { updatedAt: data.updatedAt });
      return data;
    }
    return null;
  } catch (error) {
    console.error(`[Session] 获取知识库数据失败 [${symptomKey}]:`, error);
    return null;
  }
}

type SessionRes = {
  patient?: {
    birthDate?: string;
    name?: string;
    gender?: string;
    ethnicity?: string;
    nativePlace?: string;
    placeOfBirth?: string;
    address?: string;
    occupation?: string;
    employer?: string;
    contactInfo?: { phone?: string };
  };
  historian?: string;
  reliability?: string;
  historianRelationship?: string;
} & Record<string, unknown>;

// 删除未使用的本地变量

const Session: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const setModule = useAssistantStore(s => s.setModule);
  const setProgress = useAssistantStore(s => s.setProgress);
  const setPanel = useAssistantStore(s => s.setPanel);
  const setActions = useAssistantStore(s => s.setActions);
  const setNewMessage = useAssistantStore(s => s.setNewMessage);

  // Mapping State
  const [synonymMap, setSynonymMap] = useState<Record<string, string>>({});
  const [nameToKeyMap, setNameToKeyMap] = useState<Record<string, string>>({});
  const [mappingsLoaded, setMappingsLoaded] = useState(false);

  // Fetch Mappings
  useEffect(() => {
    const load = async () => {
      type MappingPayload = { synonyms: Record<string, string>; nameToKey: Record<string, string> };
      const res = await api.get('/mapping/symptoms') as ApiResponse<MappingPayload>;
      if (res.success && res.data) {
        Object.assign(NAME_TO_HPI_KEY, res.data.nameToKey);
        setSynonymMap(res.data.synonyms);
        setNameToKeyMap(res.data.nameToKey);
        setMappingsLoaded(true);
      }
    };
    load();
  }, []);

  const nameToKey = useCallback((symptomName: string): string => {
    const normalizedName = synonymMap[symptomName] || symptomName;
    return nameToKeyMap[normalizedName] || normalizedName.toLowerCase().replace(/\s+/g, '_');
  }, [synonymMap, nameToKeyMap]);

  const getKnowledgeByName = useCallback(async (symptomName: string): Promise<KnowledgeItem | null> => {
    const key = nameToKey(symptomName);
    
    const cached = knowledgeCache.get(key);
    if (cached) {
      const age = Date.now() - cached.fetchedAt;
      if (age < KNOWLEDGE_TTL_MS) {
        return cached.item;
      } else {
        console.log(`[Session] 缓存过期，触发重拉取: ${key}`);
        const fresh = await fetchKnowledgeFromAPI(key);
        return fresh || cached.item;
      }
    }
    
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key)!;
    }
    
    const request = fetchKnowledgeFromAPI(key);
    pendingRequests.set(key, request);
    
    const result = await request;
    pendingRequests.delete(key);
    
    return result;
  }, [nameToKey]);

  const revalidateActiveKnowledge = useCallback(async (symptomNames: string[], onUpdated: () => void) => {
    const keys = symptomNames.map(nameToKey);
    let hasUpdate = false;
    for (const key of keys) {
      const cached = knowledgeCache.get(key);
      try {
        const response: ApiResponse<KnowledgeItem> = await api.get(`/knowledge/${key}`);
        if (response.success && response.data) {
          const serverItem = response.data as KnowledgeItem;
          const cachedUpdated = cached?.item?.updatedAt;
          
          // 如果缓存不存在，或者服务端更新时间比缓存新（或缓存无时间），则更新
          const shouldUpdate = !cached || 
                              (serverItem.updatedAt && 
                               (!cachedUpdated || serverItem.updatedAt !== cachedUpdated));

          if (shouldUpdate) {
            knowledgeCache.set(key, { item: serverItem, fetchedAt: Date.now() });
            
            // 仅当是已有缓存的更新时才提示用户，避免初次加载弹窗
            if (cached && !versionNotifiedKeys.has(key)) {
              versionNotifiedKeys.add(key);
              message.info(`知识库【${serverItem.displayName}】已更新，已自动刷新`);
            }
            hasUpdate = true;
          }
        }
      } catch (e) {
        console.error(`[Session] 版本校验失败 [${key}]`, e);
      }
    }
    if (hasUpdate) {
      onUpdated();
    }
  }, [nameToKey]);
  
  const [loading, setLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState('general');
  const [sections, setSections] = useState<SectionStatus[]>(
    SECTIONS.map(s => ({ ...s, isCompleted: false }))
  );
  
  // Knowledge Context
  const [symptomContext, setSymptomContext] = useState<SymptomContext | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  
  // Report Modal State
  const [reportVisible, setReportVisible] = useState(false);
  const [reportContent, setReportContent] = useState('');

  // Watch form changes for Knowledge Base updates
  const chiefComplaintValues = Form.useWatch(['chiefComplaint'], form);
  const chiefComplaintText = Form.useWatch(['chiefComplaint', 'text'], form) as string | undefined;
  const hpiAssociated = Form.useWatch(['presentIllness', 'associatedSymptoms'], form) as string[] | undefined;
  const pastHistoryConfirmed = Form.useWatch(['pastHistory', 'confirmedSymptoms'], form) as string[] | undefined;
  const birthPlace = Form.useWatch(['placeOfBirth'], form) as string | undefined;
  const occupationVal = Form.useWatch(['occupation'], form) as string | undefined;
  const phoneVal = Form.useWatch(['phone'], form) as string | undefined;

  /**
   * pickActiveSymptoms
   * 归一化并聚合主诉、现病史伴随与既往已确认症状为标准术语列表
   */
  const pickActiveSymptoms = React.useCallback((): string[] => {
      const activeSymptoms: string[] = [];
      const ccSymptom = chiefComplaintValues?.symptom as string | undefined;
      const ccText = (chiefComplaintValues?.text as string | undefined) || "";
      
      const isValidSymptom = (name: string) => !!nameToKeyMap[name];

      if (ccSymptom) {
        const negPatterns = [`否认${ccSymptom}`, `无${ccSymptom}`, `不伴${ccSymptom}`, `未见${ccSymptom}`];
        const isNeg = negPatterns.some(p => ccText.includes(p));
        const normalized = synonymMap[ccSymptom.trim()] || ccSymptom.trim();
        if (!isNeg && (isValidSymptom(normalized) || isValidSymptom(ccSymptom.trim()))) {
          activeSymptoms.push(normalized);
        }
      }
      if (hpiAssociated && hpiAssociated.length > 0) {
        for (const k of hpiAssociated) {
          const mapped = HPI_ASSOCIATED_MAP[k];
          const normalized = mapped ? (synonymMap[mapped] || mapped) : undefined;
          if (normalized && isValidSymptom(normalized)) {
            activeSymptoms.push(normalized);
          }
        }
      }
      if (pastHistoryConfirmed && pastHistoryConfirmed.length > 0) {
        for (const s of pastHistoryConfirmed) {
          const name = String(s).trim();
          const normalized = synonymMap[name] || name;
          if (normalized && isValidSymptom(normalized)) {
            activeSymptoms.push(normalized);
          }
        }
      }
      return Array.from(new Set(activeSymptoms));
  }, [chiefComplaintValues, hpiAssociated, pastHistoryConfirmed, synonymMap, nameToKeyMap]);

  const updateSymptomContext = useCallback(async (symptoms: string[]) => {
    if (symptoms.length === 0) {
      setSymptomContext(null);
      setKnowledgeLoading(false);
      return;
    }

    setKnowledgeLoading(true);
    const name = symptoms.join('、');
    const questionsSet = new Set<string>();
    const relatedSet = new Set<string>();
    const redFlagsSet = new Set<string>();
    const physicalSignsSet = new Set<string>();
    let latestUpdatedAt: string | undefined;

    for (const s of symptoms) {
      const knowledge = await getKnowledgeByName(s);
      if (knowledge) {
        for (const q of knowledge.requiredQuestions || []) {
            if (typeof q === 'string') {
                questionsSet.add(q);
            } else if (typeof q === 'object' && q !== null && 'text' in (q as Record<string, unknown>)) {
                questionsSet.add((q as { text: string }).text);
            }
        }
        for (const r of knowledge.associatedSymptoms || []) relatedSet.add(r);
        for (const f of knowledge.redFlags || []) redFlagsSet.add(f);
        if (knowledge.physicalSigns) {
          for (const p of knowledge.physicalSigns) physicalSignsSet.add(p);
        }
        if (knowledge.updatedAt) {
          if (!latestUpdatedAt || new Date(knowledge.updatedAt).getTime() > new Date(latestUpdatedAt).getTime()) {
            latestUpdatedAt = knowledge.updatedAt;
          }
        }
      } else {
        const prompt = symptomPrompts["general"];
        if (prompt) {
          for (const q of prompt.questions) questionsSet.add(q);
          for (const r of prompt.relatedSymptoms) relatedSet.add(r);
          for (const f of prompt.redFlags) redFlagsSet.add(f);
          if (prompt.physicalSigns) {
            for (const p of prompt.physicalSigns) physicalSignsSet.add(p);
          }
        }
      }
    }

    setSymptomContext({
      name,
      questions: Array.from(questionsSet),
      relatedSymptoms: Array.from(relatedSet),
      redFlags: Array.from(redFlagsSet),
      physicalSigns: Array.from(physicalSignsSet),
      updatedAt: latestUpdatedAt
    });
    setKnowledgeLoading(false);
  }, [getKnowledgeByName]);

  useEffect(() => {
    const active = pickActiveSymptoms();
    if (active.length > 0) {
      console.log('[Session] 已识别有效症状', active);
      updateSymptomContext(active);
      const timer = setInterval(() => {
        revalidateActiveKnowledge(active, () => updateSymptomContext(active));
      }, 15000);
      return () => clearInterval(timer);
    } else {
      console.log('[Session] 未识别到有效症状或为否认/无症状表达');
      setSymptomContext(null);
      setKnowledgeLoading(false);
    }
  }, [pickActiveSymptoms, updateSymptomContext, revalidateActiveKnowledge]);

  // SSE Subscription and Focus Refresh
  useEffect(() => {
    if (!mappingsLoaded) return;

    const onUpdate = () => {
       const active = pickActiveSymptoms();
       if (active.length > 0) {
          revalidateActiveKnowledge(active, () => updateSymptomContext(active));
       }
    };

    // Focus Refresh
    const onFocus = () => {
        if (document.visibilityState === 'visible') {
            console.log('[Session] 页面聚焦，检查更新');
            onUpdate();
        }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    // SSE
    const base = api.defaults?.baseURL as string | undefined;
    const root = base ? (base.endsWith('/api') ? base.slice(0, -4) : base) : '';
    const url = root ? `${root}/api/knowledge/stream` : '/api/knowledge/stream';
    let es: EventSource | null = new EventSource(url);
    
    es.addEventListener('knowledge_updated', () => {
        console.log('[Session] 收到知识库更新通知');
        onUpdate();
    });
    
    es.onerror = (e) => {
        console.error('[Session] SSE Error', e);
        es?.close();
        es = null;
    };

    return () => {
       window.removeEventListener('focus', onFocus);
       document.removeEventListener('visibilitychange', onFocus);
       if (es) {
         es.close();
       }
    };
  }, [mappingsLoaded, pickActiveSymptoms, revalidateActiveKnowledge, updateSymptomContext]);

/**
 * handleChiefComplaintTextChange
 * 实时监听完整主诉描述的文本变化，调用后端 NLP 接口解析出涉及的症状，
 * 并自动同步到 presentIllness.associatedSymptoms，驱动知识库助手实时更新
 */
const analyzeTimerRef = React.useRef<number | null>(null);
useEffect(() => {
  const text = (chiefComplaintText || '').trim();
  if (analyzeTimerRef.current) {
    clearTimeout(analyzeTimerRef.current);
    analyzeTimerRef.current = null;
  }
  if (!text) {
    return;
  }
  analyzeTimerRef.current = window.setTimeout(async () => {
    try {
      type AnalyzeResData = {
        matchedSymptoms: { name: string; key: string }[];
        duration: { value: number | null; unit: string | null };
        normalizedComplaint: string;
        originalText: string;
        validation: { inputSymptoms: string[]; mappedKeys: string[]; missingKnowledge: string[]; consistent: boolean };
        matchedCount: number;
        perSymptomDurations: { name: string; value: number; unit: string }[];
        normalizationSafe: boolean;
      };
      const res = await api.post('/nlp/analyze', { text }) as import('../../utils/api').ApiResponse<AnalyzeResData>;
      if (res.success && res.data) {
        const data = res.data as AnalyzeResData;
        const ccSymptom = (chiefComplaintValues?.symptom as string | undefined) || '';
        const names = (data.matchedSymptoms || []).map(m => m.name);
        const normalizedNames = names.map(n => synonymMap[n] || n);
        const assocNames = normalizedNames.filter(n => n && n !== ccSymptom);
        const allowedSystem = SYMPTOM_TO_SYSTEM[ccSymptom || ''];
        const assocNamesFiltered = allowedSystem ? assocNames.filter(n => SYMPTOM_TO_SYSTEM[n] === allowedSystem) : [];
        const assocKeys = assocNamesFiltered
          .map(n => NAME_TO_HPI_KEY[n])
          .filter((k): k is string => !!k);
        const prevAssoc = (form.getFieldValue(['presentIllness', 'associatedSymptoms']) as string[] | undefined) || [];
        const mergedAssoc = Array.from(new Set([...(prevAssoc || []), ...assocKeys]));
        if (mergedAssoc.length !== (prevAssoc || []).length) {
          form.setFieldsValue({
            presentIllness: {
              ...(form.getFieldValue('presentIllness') || {}),
              associatedSymptoms: mergedAssoc
            }
          });
          console.log('[Session] 主诉文本解析更新伴随症状(同系统过滤)', { text, ccSymptom, allowedSystem, assocNames, assocNamesFiltered, assocKeys: mergedAssoc });
        } else {
          console.log('[Session] 主诉文本解析未发现新增伴随症状或无同系统匹配', { text, ccSymptom, allowedSystem, assocNames });
        }
        const active = pickActiveSymptoms();
        if (active.length > 0) {
          await updateSymptomContext(active);
        } else {
          setSymptomContext(null);
          setKnowledgeLoading(false);
        }

        // 更新智能助手迷你面板（主诉模块）为真实 NLP 结果
        const durationToText = (v?: number | null, u?: string | null): string | undefined => {
          if (!v || !u) return undefined;
          const unitMap: Record<string, string> = { day: '天', days: '天', week: '周', weeks: '周', month: '月', months: '月', hour: '小时', hours: '小时' };
          const suffix = unitMap[u] || u;
          return `${v}${suffix}`;
        };
        const overallDuration = durationToText(data.duration?.value ?? null, data.duration?.unit ?? null);
        const recognized = {
          symptom: ccSymptom || (normalizedNames[0] || ''),
          duration: overallDuration || (data.perSymptomDurations?.[0] ? durationToText(data.perSymptomDurations[0].value, data.perSymptomDurations[0].unit) : undefined) || '—'
        };
        // 调用后端诊断建议接口，替换疾病关联为真实结果
        try {
          type SuggestPayload = string[];
          const sid = Number(id);
          if (!Number.isFinite(sid)) {
            console.warn('[Session] 跳过诊断建议调用：会话ID无效', { id });
          } else {
            const suggestRes = await api.post('/diagnosis/suggest', {
              sessionId: sid,
              symptoms: Array.from(new Set([recognized.symptom, ...assocNamesFiltered].filter(Boolean))),
              age: form.getFieldValue('age'),
              gender: form.getFieldValue('gender')
            }) as import('../../utils/api').ApiResponse<SuggestPayload>;
          const suggestions = unwrapData<SuggestPayload>(suggestRes) || suggestRes.data || [];
          useAssistantStore.getState().setPanel({
            sampleInput: data.normalizedComplaint || text,
            recognition: recognized,
            normative: { good: data.normalizedComplaint || text, bad: '发烧好几天了' },
            diseases: suggestions as string[],
            actions: ['智能完善', '示例库', '详细']
          });
          useAssistantStore.getState().setNewMessage(true);
          console.log('[Session] NLP 与诊断建议已写入助手面板(同系统症状)', { normalized: data.normalizedComplaint, recognized, assocNamesFiltered, suggestions });
          }
          // 更新操作回调
          const improveChiefComplaint = () => {
            const st = useAssistantStore.getState();
            const normalized = st.panel.normative?.good || st.panel.sampleInput || text;
            const symptom = st.panel.recognition?.symptom || (chiefComplaintValues?.symptom || '');
            form.setFieldsValue({
              chiefComplaint: {
                ...(form.getFieldValue('chiefComplaint') || {}),
                text: normalized,
                symptom
              }
            });
            message.success('已应用规范化主诉');
            console.log('[Session] 已应用规范化主诉', { normalized, symptom });
          };
          const openExampleLibrary = () => {
            const st = useAssistantStore.getState();
            const symptom = st.panel.recognition?.symptom || (chiefComplaintValues?.symptom || '');
            const q = encodeURIComponent(symptom || '');
            navigate(`/knowledge?q=${q}`);
            console.log('[Session] 已跳转到示例库', { q });
          };
          const openDetailHelp = () => {
            const st = useAssistantStore.getState();
            const symptom = st.panel.recognition?.symptom || (chiefComplaintValues?.symptom || '');
            const q = encodeURIComponent(symptom || '');
            navigate(`/knowledge?q=${q}`);
            console.log('[Session] 已跳转到详细帮助', { q });
          };
          useAssistantStore.getState().setActions({
            improveChiefComplaint,
            openExampleLibrary,
            openDetailHelp
          });
        } catch (e) {
          console.error('[Session] 诊断建议接口调用失败', e);
        }
      }
    } catch (e) {
      console.error('[Session] 主诉文本解析失败', e);
    }
  }, 600);
  return () => {
    if (analyzeTimerRef.current) {
      clearTimeout(analyzeTimerRef.current);
      analyzeTimerRef.current = null;
    }
  };
}, [chiefComplaintText, chiefComplaintValues, form, pickActiveSymptoms, updateSymptomContext, synonymMap, navigate]);

  const allValues = Form.useWatch([], form);

  useEffect(() => {
    if (!allValues) return;
    const val = allValues as FormValues;

    const newSections = SECTIONS.map(s => {
      let isCompleted = false;
      switch (s.key) {
        case 'general':
          isCompleted = !!(val.name && val.gender && (val.age || val.birthDate));
          break;
        case 'chief_complaint':
          isCompleted = !!(val.chiefComplaint?.text);
          break;
        case 'hpi':
          {
            const hpi = val.presentIllness || {};
            const hasOnset = !!(hpi.onsetMode || hpi.onsetTime || hpi.trigger);
            const hasSymptom = !!(hpi.location || (hpi.quality && hpi.quality.length > 0) || hpi.severity || hpi.durationDetails || hpi.factors);
            const hasTreatment = !!hpi.treatmentHistory;
            isCompleted = (hasOnset && hasSymptom) || hasTreatment;
            break;
          }
        case 'past_history':
          {
            const ph = val.pastHistory || {};
            const hasDisease = Array.isArray(ph.pmh_diseases) && ph.pmh_diseases.length > 0;
            const hasSurgery = !!ph.pmh_trauma_surgery;
            const hasAllergy = !!(ph.pmh_allergies || ph.hasAllergy === 'yes');
            const hasInfectious = !!ph.pmh_infectious;
            const hasOther = !!ph.pmh_other;
            isCompleted = hasDisease || hasSurgery || hasAllergy || hasInfectious || hasOther;
            break;
          }
        case 'personal_history':
          {
            const per = val.personalHistory || {};
            isCompleted = !!(per.smoking_status && per.alcohol_status);
            break;
          }
        case 'marital_history':
          {
            const mar = val.maritalHistory || {};
            const isFemale = val.gender === '女';
            const hasMaritalStatus = !!mar.status;
            if (isFemale) {
              const mens = val.menstrualHistory || {};
              const fert = val.fertilityHistory || {};
              const hasMens = !!(mens.age || mens.lmp || mens.menopause_age);
              const hasFert = !!fert.summary;
              isCompleted = hasMaritalStatus && hasMens && hasFert;
            } else {
              isCompleted = hasMaritalStatus;
            }
            break;
          }
        case 'family_history':
          {
            const fam = val.familyHistory || {};
            isCompleted = !!(fam.father || fam.mother || (Array.isArray(fam.genetic_diseases) && fam.genetic_diseases.length > 0) || fam.deceased || fam.other);
            break;
          }
        case 'review_of_systems':
          {
            const ros = val.reviewOfSystems || {};
            const systems = ['respiratory', 'cardiovascular', 'digestive', 'urinary', 'hematologic', 'endocrine', 'neurological', 'musculoskeletal'];
            isCompleted = systems.some((sys: string) => {
              const sysData = ros[sys] || {};
              return ((Array.isArray(sysData.symptoms) && sysData.symptoms.length > 0)) || !!sysData.details;
            });
            break;
          }
      }
      return { ...s, isCompleted };
    });

    setSections(prev => {
      const isDifferent = prev.some((p, i) => p.isCompleted !== newSections[i].isCompleted);
      return isDifferent ? newSections : prev;
    });
  }, [allValues]);

  // Load Initial Data
  /**
   * fetchSession
   * 加载后端会话数据，回填表单
   */
  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/sessions/${id}`) as unknown as import('../../utils/api').ApiResponse<SessionRes>;
      if (res.success && res.data) {
        const data = res.data as SessionRes;
        const patient = data.patient || {};
        const birth = patient.birthDate ? new Date(patient.birthDate) : undefined;
        const age = birth ? Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined;
        form.setFieldsValue({
            ...data,
            name: patient.name,
            gender: patient.gender,
            birthDate: patient.birthDate ? dayjs(patient.birthDate) : undefined,
            age,
            ethnicity: patient.ethnicity,
            nativePlace: patient.nativePlace,
            placeOfBirth: patient.placeOfBirth,
            address: patient.address,
            occupation: patient.occupation,
            employer: patient.employer,
            phone: patient.contactInfo?.phone,
            historian: data.historian,
            reliability: data.reliability,
            historianRelationship: data.historianRelationship
        });
        
        console.log('[Session] 会话数据加载完成', data);
      }
    } catch (error) {
      console.error(error);
      message.error('加载会话失败');
    } finally {
      setLoading(false);
    }
  }, [id, form]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);


  /**
   * handleSave
   * 校验并保存当前表单数据到后端
   * @param skipValidation 是否跳过表单校验（用于中途退出保存草稿）
   */
  const handleSave = async (skipValidation = false): Promise<boolean> => {
    try {
      setLoading(true);
      if (!skipValidation) {
        await form.validateFields();
      }
      
      const allValues: Record<string, unknown> = form.getFieldsValue();
      
      // Send PATCH request
      const res = await api.patch(`/sessions/${id}`, allValues) as unknown as import('../../utils/api').ApiResponse<unknown>;
      
      if (res.success) {
        message.success('保存成功');
        console.log('[Session] 保存成功', allValues);
        return true;
      }
      return false;
    } catch (error) {
      console.error(error);
      const hasErrorFields = (e: unknown): e is { errorFields: unknown } =>
        typeof e === 'object' && e !== null && 'errorFields' in (e as Record<string, unknown>);
      if (hasErrorFields(error)) {
          message.error('验证未通过，请检查表单');
      } else {
          message.error('保存失败');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * handleExport
   * 先保存，再请求生成标准化病历文本，并展示预览弹窗
   */
  const handleExport = async () => {
    try {
        setLoading(true);
        // Ensure saved first (with validation)
        const saved = await handleSave(false); 
        if (!saved) return;
        
        // Update status to archived after saving
        try {
            const statusRes = await api.patch(`/sessions/${id}`, { status: 'archived' }) as unknown as import('../../utils/api').ApiResponse<SessionRes>;
            if (statusRes?.success) {
                message.success('已归档病历');
                console.log('[Session] 状态更新为 archived');
            } else {
                console.warn('[Session] 状态更新失败或未返回成功标志');
            }
        } catch (e) {
            console.error('[Session] 状态更新请求失败', e);
            message.warning('状态更新失败，已继续生成报告');
        }
        
        const res = await api.post(`/sessions/${id}/report`) as unknown as import('../../utils/api').ApiResponse<{ report?: string }>;
        if (res.success && res.data) {
            setReportContent(res.data.report || JSON.stringify(res.data, null, 2));
            setReportVisible(true);
            console.log('[Session] 报告生成成功');
        }
    } catch (error) {
        console.error(error);
        message.error('生成报告失败');
    } finally {
        setLoading(false);
    }
  };

  /**
   * handleCopyReport
   * 复制报告文本到剪贴板
   */
  const handleCopyReport = () => {
    navigator.clipboard.writeText(reportContent);
    message.success('已复制到剪贴板');
  };

  /**
   * handleDownloadReport
   * 下载报告为 txt 文件
   */
  const handleDownloadReport = () => {
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `病历_${new Date().toLocaleDateString()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
 
  const handleClosePreview = () => {
    setReportVisible(false);
    message.success('问诊已完成，返回首页');
    navigate('/');
    console.log('[Session] 已返回首页，统计将在首页刷新');
  };

  // Calculate progress
  const progress = Math.round((sections.filter(s => s.isCompleted).length / sections.length) * 100);

  /**
   * syncAssistantContext
   * 同步智能助手上下文（模块/进度/面板数据）
   */
  useEffect(() => {
    const label = SECTIONS.find(s => s.key === currentSection)?.label || currentSection;
    setModule(currentSection as ModuleKey, label);
    setProgress(progress);
    if (currentSection === 'general') {
      const pending: string[] = [];
      if (!birthPlace) pending.push('出生地');
      if (!occupationVal) pending.push('职业');
      if (!phoneVal) pending.push('联系电话');
      const doneCount = 5 - pending.length;
      setPanel({
        pendingItems: pending,
        tips: ['年龄联动', '病史陈述者'],
        validationText: `必填项：${doneCount}/5完成`,
        actions: ['语音输入', '详细帮助']
      });
      /**
       * startVoiceInput
       * 聚焦一般项目的“姓名”输入框，引导语音/键盘输入
       */
      const startVoiceInput = () => {
        try {
          setNewMessage(false);
          // 尝试滚动到字段并聚焦
          form.scrollToField?.('name');
          const el = document.querySelector('input#name') as HTMLInputElement | null;
          el?.focus();
          message.success('请开始录入一般项目信息');
          console.log('[Session] 语音输入引导：已滚动并聚焦到“姓名”');
        } catch (e) {
          console.log('[Session] 语音输入引导失败，已忽略', e);
        }
      };
      /**
       * openDetailHelp (general)
       * 跳转至知识库页面查看通用要点
       */
      const openDetailHelp = () => {
        navigate('/knowledge');
        console.log('[Session] 一般项目详细帮助：已跳转知识库');
      };
      setActions({
        startVoiceInput,
        openDetailHelp
      });
    } else if (currentSection === 'hpi') {
      const timeline = [
        { label: '5天前：起病', done: !!(form.getFieldValue(['presentIllness', 'onsetTime'])) },
        { label: '3天前：咳嗽', done: !!(hpiAssociated || []).includes('cough') },
        { label: '今日：待补充', done: false },
      ];
      const hpi = (form.getFieldValue('presentIllness') || {}) as Record<string, unknown>;
      const careMissing: string[] = [];
      if (!hpi['treatmentHistory']) careMissing.push('缺少诊治经过');
      const negDetails = form.getFieldValue(['presentIllness', 'associatedSymptomsDetails']) as string | undefined;
      if (!negDetails || !/^伴有|否认|未见/.test(negDetails)) careMissing.push('缺少阴性症状或伴随症状详情');
      const hpiCareValidationTip = careMissing.length > 0 ? careMissing.join('；') : '校验通过';
      setPanel({
        timeline,
        guidance: ['伴随症状？', '诊治经过？', '一般情况？'],
        omissions: ['阴性症状记录', '诊治经过详情'],
        hpiCareValidationTip,
        actions: ['时间线编辑', '症状推荐', '详细']
      });
      /**
       * editTimeline
       * 聚焦“诊治记录”文本域，便于编辑时间线
       */
      const editTimeline = () => {
        try {
          setNewMessage(false);
          form.scrollToField?.(['presentIllness', 'treatmentHistory']);
          const el = document.querySelector('textarea#presentIllness_treatmentHistory') as HTMLTextAreaElement | null;
          el?.focus();
          message.success('已定位到病史时间线编辑区');
          console.log('[Session] 时间线编辑：已滚动并聚焦到“诊治记录”');
        } catch (e) {
          console.log('[Session] 时间线编辑定位失败，已忽略', e);
        }
      };
      /**
       * checkHpiCompleteness
       * 校验现病史的诊治经过与伴随症状详情完整性，写回提示
       */
      const checkHpiCompleteness = () => {
        const hpiNow = (form.getFieldValue('presentIllness') || {}) as Record<string, unknown>;
        const missing: string[] = [];
        if (!hpiNow['treatmentHistory']) missing.push('缺少诊治经过');
        const assoc = form.getFieldValue(['presentIllness', 'associatedSymptoms']) as string[] | undefined;
        const assocDet = form.getFieldValue(['presentIllness', 'associatedSymptomsDetails']) as string | undefined;
        if ((assoc && assoc.length > 0) && (!assocDet || assocDet.trim().length === 0)) {
          missing.push('伴随症状缺少具体描述');
        }
        const tip = missing.length > 0 ? missing.join('；') : '校验通过';
        useAssistantStore.getState().setPanel({ hpiCareValidationTip: tip });
        if (missing.length > 0) {
          message.warning(tip);
          form.scrollToField(['presentIllness', 'treatmentHistory']);
        } else {
          message.success(tip);
        }
        console.log('[Session] 现病史诊治经过完整性校验', { missing });
      };
      /**
       * recommendSymptoms
       * 根据知识库上下文推荐伴随症状，自动写入 presentIllness.associatedSymptoms
       */
      const recommendSymptoms = () => {
        try {
          const ccSymptom = (chiefComplaintValues?.symptom as string | undefined) || '';
          const allowedSystem = SYMPTOM_TO_SYSTEM[ccSymptom || ''];
          if (!allowedSystem) {
            message.info('主诉未明确关联系统，已取消自动勾选');
            console.log('[Session] 症状推荐取消：主诉无系统映射', { ccSymptom });
            return;
          }
          const related = (symptomContext?.relatedSymptoms || []).filter(Boolean);
          const filteredNames = related.filter(n => SYMPTOM_TO_SYSTEM[n] === allowedSystem);
          const keys = filteredNames
            .map(n => NAME_TO_HPI_KEY[n])
            .filter((k): k is string => !!k);
          const prev = (form.getFieldValue(['presentIllness', 'associatedSymptoms']) as string[] | undefined) || [];
          const merged = Array.from(new Set([...(prev || []), ...keys]));
          form.setFieldsValue({
            presentIllness: {
              ...(form.getFieldValue('presentIllness') || {}),
              associatedSymptoms: merged
            }
          });
          const tip = keys.length > 0 ? '已根据主诉系统推荐伴随症状' : '同系统无可推荐伴随症状';
          message.success(tip);
          console.log('[Session] 症状推荐：同系统过滤写入伴随症状', { ccSymptom, allowedSystem, related, filteredNames, keys, merged });
        } catch (e) {
          console.log('[Session] 症状推荐失败，已忽略', e);
        }
      };
      /**
       * openDetailHelp (hpi)
       * 跳转至知识库页面查看当前症状的详细规范
       */
      const openDetailHelp = () => {
        const ccSymptom = (chiefComplaintValues?.symptom as string | undefined) || '';
        const q = encodeURIComponent(ccSymptom || '');
        navigate(`/knowledge?q=${q}`);
        console.log('[Session] 现病史详细帮助：已跳转知识库', { q });
      };
      setActions({
        editTimeline,
        checkHpiCompleteness,
        recommendSymptoms,
        openDetailHelp
      });
    } else if (currentSection === 'past_history') {
      setPanel({
        tips: ['过敏史必须确认', '手术外伤记录格式统一'],
        actions: ['智能补全', '详细']
      });
      /**
       * completePastHistory
       * 智能补全既往史：默认否认过敏史、为已选疾病补齐控制情况字段、提示手术记录格式
       */
      const completePastHistory = () => {
        try {
          const ph = (form.getFieldValue('pastHistory') || {}) as Record<string, unknown>;
          const hasAllergy = ph['hasAllergy'] as 'yes' | 'no' | undefined;
          if (!hasAllergy) {
            form.setFieldsValue({
              pastHistory: {
                ...(ph || {}),
                hasAllergy: 'no',
                allergyHistory: '否认药物及食物过敏史。'
              }
            });
          }
          const diseases = (ph['pmh_diseases'] as string[] | undefined) || [];
          if (Array.isArray(diseases) && diseases.length > 0) {
            const details = (ph['diseaseDetails'] as Record<string, { year?: string; control?: string; medication?: string }> | undefined) || {};
            const next: Record<string, { year?: string; control?: string; medication?: string }> = { ...details };
            for (const d of diseases) {
              const prev = next[d] || {};
              if (!prev.control) prev.control = '良好';
              next[d] = prev;
            }
            form.setFieldsValue({
              pastHistory: {
                ...(ph || {}),
                diseaseDetails: next
              }
            });
          }
          const sh = ph['surgeryHistory'] as string | undefined;
          if (!sh) {
            form.setFieldsValue({
              pastHistory: {
                ...(ph || {}),
                surgeryHistory: '格式：时间 + 事件 + 结果。示例：2015年因胆囊结石行腹腔镜胆囊切除术，无输血，术后恢复顺利。'
              }
            });
          }
          message.success('已智能补全既往史');
          console.log('[Session] 既往史智能补全完成', { updatedAllergy: !hasAllergy, diseasesCount: diseases.length, surgeryHistoryAdded: !sh });
        } catch (e) {
          console.log('[Session] 既往史智能补全失败，已忽略', e);
        }
      };
      /**
       * openDetailHelp (past_history)
       * 跳转至知识库页面查看规范项
       */
      const openDetailHelp = () => {
        navigate('/knowledge');
        console.log('[Session] 既往史详细帮助：已跳转知识库');
      };
      setActions({
        completePastHistory,
        openDetailHelp
      });
    } else if (currentSection === 'review_of_systems') {
      const flags = (symptomContext?.redFlags || []);
      const redFlagsTip = flags.length > 0 ? `警惕征象：${flags.join('、')}；必要时尽快处理或转诊` : '未识别到特定红旗征';
      setPanel({
        tips: ['至少记录一个系统', '注意重要阴性症状'],
        redFlagsTip,
        actions: ['红旗征提醒', '引导', '详细']
      });
      /**
       * guideReviewOfSystems
       * 引导系统回顾：根据当前症状上下文定位到相关系统并填入引导语
       */
      const guideReviewOfSystems = () => {
        try {
          const symptom = (chiefComplaintValues?.symptom as string | undefined) || '';
          const related = (symptomContext?.relatedSymptoms || []);
          const pick = (arr: string[]): string | undefined => arr.find(Boolean);
          const candidate = pick([symptom, ...related]) || '';
          const systemKey = SYMPTOM_TO_SYSTEM[candidate] || 'respiratory';
          form.scrollToField?.(['reviewOfSystems', systemKey, 'details']);
          const inputId = `reviewOfSystems_${systemKey}_details`;
          const el = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null;
          const guideParts = ['建议询问：起止时间、诱因、阴性症状与体征'];
          const flags = (symptomContext?.redFlags || []);
          if (flags.length > 0) {
            guideParts.push(`警惕征象：${flags.join('、')}`);
          }
          const guideText = guideParts.join('；');
          const current = form.getFieldValue(['reviewOfSystems', systemKey, 'details']) as string | undefined;
          if (!current) {
            form.setFieldsValue({
              reviewOfSystems: {
                ...(form.getFieldValue('reviewOfSystems') || {}),
                [systemKey]: {
                  ...((form.getFieldValue(['reviewOfSystems', systemKey]) as Record<string, unknown>) || {}),
                  details: guideText
                }
              }
            });
          }
          el?.focus();
          message.success('已为系统回顾提供引导');
          console.log('[Session] 系统回顾引导：已定位并填入引导语', { systemKey, candidate, guideText });
        } catch (e) {
          console.log('[Session] 系统回顾引导失败，已忽略', e);
        }
      };
      /**
       * remindRedFlags
       * 将当前识别到的红旗征写回面板提示，并定位到系统详情输入框
       */
      const remindRedFlags = () => {
        const fl = (symptomContext?.redFlags || []);
        const tip = fl.length > 0 ? `警惕征象：${fl.join('、')}` : '暂无红旗征';
        useAssistantStore.getState().setPanel({ redFlagsTip: tip });
        const systemKey = 'respiratory';
        form.scrollToField?.(['reviewOfSystems', systemKey, 'details']);
        message.success('已提示当前红旗征，请结合系统详情记录');
        console.log('[Session] 红旗征自动提醒', { tip, fl });
      };
      /**
       * openDetailHelp (review_of_systems)
       * 跳转至知识库页面查看当前症状的详细规范
       */
      const openDetailHelp = () => {
        const ccSymptom = (chiefComplaintValues?.symptom as string | undefined) || '';
        const q = encodeURIComponent(ccSymptom || '');
        navigate(`/knowledge?q=${q}`);
        console.log('[Session] 系统回顾详细帮助：已跳转知识库', { q });
      };
      setActions({
        remindRedFlags,
        guideReviewOfSystems,
        openDetailHelp
      });
    } else if (currentSection === 'personal_history') {
      const smokingStatus = form.getFieldValue(['personalHistory', 'smoking_status']);
      const cpd = form.getFieldValue(['personalHistory', 'cigarettesPerDay']) as number | undefined;
      const years = form.getFieldValue(['personalHistory', 'smokingYears']) as number | undefined;
      const index = (smokingStatus === '吸烟' || smokingStatus === '已戒烟') && cpd && years ? cpd * years : 0;
      const smokingIndexHint = index > 0 ? `${cpd}支/日 × ${years}年 = ${index}年支` : '请填写每日支数与烟龄';
      const alcoholStatus = form.getFieldValue(['personalHistory', 'alcohol_status']);
      const vol = form.getFieldValue(['personalHistory', 'drinkVolume']) as number | undefined;
      const deg = form.getFieldValue(['personalHistory', 'alcoholDegree']) as number | undefined;
      const grams = (alcoholStatus === '饮酒' || alcoholStatus === '已戒酒') && vol && deg ? (vol * (deg / 100) * 0.8).toFixed(1) : undefined;
      const freq = form.getFieldValue(['personalHistory', 'drinkFreqPerWeek']) as number | undefined;
      const weeklyAlcoholHint = (alcoholStatus === '饮酒' || alcoholStatus === '已戒酒') && vol && deg && typeof freq === 'number' && freq > 0
        ? `每周约 ${(Number(grams || '0') * freq).toFixed(1)}g 酒精`
        : '请填写饮酒频率以估算每周总量';
      const drinkingHint = grams ? `每次${vol}ml(${deg}%) ≈ ${grams}g酒精` : '请填写日饮量与度数';
      const workCond = form.getFieldValue(['personalHistory', 'work_cond']) as string | undefined;
      const exposureKeywords = ['粉尘', '石棉', '苯', '甲醛', '汞', '铅', '辐射', '噪音', '高温', '低温', '化学品', '农药'];
      const detected = (workCond || '').split(/[，。,.;；\s]/).filter(k => exposureKeywords.some(e => k.includes(e))).filter(Boolean);
      const occupationalExposureTip = detected.length > 0 
        ? `识别到可能职业暴露：${Array.from(new Set(detected)).join('、')}；请记录接触时长、频次与防护措施`
        : '未识别明确职业暴露，请完善“工作环境/接触史”';
      setPanel({
        smokingIndexHint,
        drinkingHint,
        weeklyAlcoholHint,
        occupationalExposureTip,
        actions: ['智能提示', '职业暴露提示', '详细']
      });
      /**
       * suggestOccupationalExposure
       * 根据“工作环境/接触史”识别潜在职业暴露并引导完善记录
       */
      const suggestOccupationalExposure = () => {
        const current = form.getFieldValue(['personalHistory', 'work_cond']) as string | undefined;
        const tip = occupationalExposureTip;
        if (!current || current.trim().length === 0) {
          form.scrollToField(['personalHistory', 'work_cond']);
          message.info('请先填写工作环境/接触史，以便评估职业暴露风险');
        } else {
          message.success('已评估职业暴露提示');
        }
        useAssistantStore.getState().setPanel({ occupationalExposureTip: tip });
        console.log('[Session] 职业暴露提示', { workCond: current, tip });
      };
      const showPersonalHints = () => {
        const needsSmoking = (smokingStatus === '吸烟' || smokingStatus === '已戒烟') && (!cpd || !years);
        const needsAlcohol = (alcoholStatus === '饮酒' || alcoholStatus === '已戒酒') && (!vol || !deg);
        if (needsSmoking) {
          form.scrollToField(['personalHistory', 'cigarettesPerDay']);
          message.info('请补充每日吸烟支数与烟龄以计算吸烟指数');
        } else if (needsAlcohol) {
          form.scrollToField(['personalHistory', 'drinkVolume']);
          message.info('请补充日饮量与度数以估算酒精量');
        } else {
          message.success('个人史关键数据已完整');
        }
        useAssistantStore.getState().setPanel({
          smokingIndexHint,
          drinkingHint,
          weeklyAlcoholHint
        });
        console.log('[Session] 个人史智能提示', { smokingStatus, cpd, years, alcoholStatus, vol, deg });
      };
      const openDetailHelp = () => {
        const q = (smokingStatus === '吸烟' || smokingStatus === '已戒烟') ? '吸烟史' : ((alcoholStatus === '饮酒' || alcoholStatus === '已戒酒') ? '饮酒史' : '个人史');
        navigate(`/knowledge?q=${encodeURIComponent(q)}`);
        console.log('[Session] 个人史详细帮助跳转', { q });
      };
      setActions({
        showPersonalHints,
        suggestOccupationalExposure,
        openDetailHelp
      });
    } else if (currentSection === 'marital_history') {
      const gender = form.getFieldValue('gender') as string | undefined;
      const marriageAge = form.getFieldValue(['maritalHistory', 'marriage_age']) as number | undefined;
      const menarcheAge = form.getFieldValue(['menstrualHistory', 'age']) as number | undefined;
      const lmp = form.getFieldValue(['menstrualHistory', 'lmp_date']) as string | undefined;
      const menopauseAge = form.getFieldValue(['menstrualHistory', 'menopause_age']) as number | undefined;
      const age = form.getFieldValue('age') as number | undefined;
      const validations: string[] = [];
      if (typeof marriageAge === 'number') {
        if (marriageAge < 18) validations.push('结婚年龄不符合法定要求');
        if (marriageAge > 80) validations.push('结婚年龄异常，请核对');
      }
      if (gender === '女') {
        if (!menarcheAge) validations.push('缺少月经初潮年龄');
        if (lmp) {
          const t = dayjs(lmp);
          if (t.isAfter(dayjs())) validations.push('末次月经日期不应晚于今天');
        }
        if (typeof menopauseAge === 'number' && typeof age === 'number' && menopauseAge > age) {
          validations.push('绝经年龄不应大于当前年龄');
        }
      }
      const maritalValidation = validations.length > 0 ? validations.join('；') : '校验通过';
      const pregnancyRedFlags = ['阴道流血', '剧烈腹痛', '胎动明显减少或消失', '高血压伴蛋白尿', '阴道流水（疑破水）'];
      const pregnancyRedFlagsTip = gender === '女' ? `妊娠相关红旗：${pregnancyRedFlags.join('、')}；如存在请尽快评估` : '—';
      setPanel({
        maritalValidation,
        pregnancyRedFlagsTip,
        actions: ['信息校验', '妊娠红旗提示', '详细']
      });
      const validateMaritalHistory = () => {
        if (validations.length === 0) {
          message.success('婚育史信息校验通过');
        } else {
          message.warning(maritalValidation);
        }
        useAssistantStore.getState().setPanel({ maritalValidation });
        if (gender === '女' && !menarcheAge) form.scrollToField(['menstrualHistory', 'age']);
        console.log('[Session] 婚育史信息校验', { gender, marriageAge, menarcheAge, lmp, menopauseAge, age, validations });
      };
      const openDetailHelp = () => {
        const q = gender === '女' ? '月经史' : '婚育史';
        navigate(`/knowledge?q=${encodeURIComponent(q)}`);
        console.log('[Session] 婚育史详细帮助跳转', { q });
      };
      /**
       * showPregnancyRedFlags
       * 显示妊娠相关症状红旗提示，并可跳转到妇产科要点
       */
      const showPregnancyRedFlags = () => {
        if (gender !== '女') {
          message.info('当前为非女性患者，已跳过妊娠红旗提示');
          return;
        }
        useAssistantStore.getState().setPanel({ pregnancyRedFlagsTip });
        navigate(`/knowledge?q=${encodeURIComponent('妇产科症状')}`);
        console.log('[Session] 妊娠相关红旗提示', { pregnancyRedFlags });
      };
      setActions({
        validateMaritalHistory,
        showPregnancyRedFlags,
        openDetailHelp
      });
    } else if (currentSection === 'family_history') {
      const fh = (form.getFieldValue('familyHistory') || {}) as Record<string, unknown>;
      const diseaseMap = (fh['diseaseMap'] as Record<string, string[]> | undefined) || {};
      const father = fh['father'] as string | undefined;
      const mother = fh['mother'] as string | undefined;
      const siblings = fh['siblings'] as string | undefined;
      const children = fh['children'] as string | undefined;
      const childrenAliveCount = fh['childrenAliveCount'] as number | undefined;
      const childrenDeceasedCount = fh['childrenDeceasedCount'] as number | undefined;
      const details = Object.entries(diseaseMap).map(([d, rels]) => rels && rels.length > 0 ? `${d}(${rels.join('、')})` : d);
      const parts = [
        father ? `父亲：${father}` : '',
        mother ? `母亲：${mother}` : '',
        siblings ? `兄弟姐妹：${siblings}` : '',
        children ? `子女：${children}` : '',
        details.length > 0 ? `家族遗传病史：${details.join('；')}` : ''
      ].filter(Boolean);
      const familySummary = parts.length > 0 ? parts.join('；\n') + '。' : '暂无摘要';
      const relCount = (rels: string[] | undefined) => (rels ? rels.length : 0);
      const highRisk: string[] = [];
      const mediumRisk: string[] = [];
      for (const [d, rels] of Object.entries(diseaseMap)) {
        const r = rels || [];
        if (r.includes('父亲') && r.includes('母亲')) {
          highRisk.push(d);
        } else if (relCount(r) >= 2) {
          mediumRisk.push(d);
        } else if (relCount(r) === 1) {
          mediumRisk.push(d);
        }
      }
      const geneticRiskTip = highRisk.length > 0
        ? `高风险家族性倾向：${highRisk.join('、')}；建议尽快进行相关筛查`
        : (mediumRisk.length > 0 ? `可能存在家族性倾向：${mediumRisk.join('、')}；建议常规体检与随访` : '未识别明显遗传风险');
      setPanel({
        familySummary,
        geneticRiskTip,
        conflictTip: undefined,
        actions: ['生成摘要', '遗传风险评估', '冲突检测', '详细']
      });
      /**
       * assessGeneticRisk
       * 结合已选择的疾病与关联亲属，评估家族遗传风险并写回提示
       */
      const assessGeneticRisk = () => {
        const tip = geneticRiskTip;
        if (tip && tip.includes('未识别')) {
          message.info('当前未识别到明确的遗传风险，请完善遗传病史与亲属关联');
        } else {
          message.success('已评估家族遗传风险');
        }
        useAssistantStore.getState().setPanel({ geneticRiskTip: tip });
        console.log('[Session] 家族遗传风险评估', { diseaseMap, tip });
      };
      const summarizeFamilyHistory = () => {
        const summary = familySummary;
        form.setFieldValue(['familyHistory', 'other'], summary);
        message.success('已生成家族史摘要');
        useAssistantStore.getState().setPanel({ familySummary: summary });
        console.log('[Session] 家族史摘要生成', { summary });
      };
      const openDetailHelp = () => {
        const q = '家族史';
        navigate(`/knowledge?q=${encodeURIComponent(q)}`);
        console.log('[Session] 家族史详细帮助跳转', { q });
      };
      /**
       * detectFamilyConflict
       * 自动检测家族史填写中的常见冲突，提示修正
       */
      const detectFamilyConflict = () => {
        const conflicts: string[] = [];
        const hasFatherConflict = !!(father && father.includes('已故') && father.includes('健康'));
        const hasMotherConflict = !!(mother && mother.includes('已故') && mother.includes('健康'));
        const childrenText = (children || '');
        const childrenAllDeceasedText = childrenText.includes('已故') && !childrenText.includes('部分') && !childrenText.includes('其中');
        const childrenCountConflict = typeof childrenAliveCount === 'number' && typeof childrenDeceasedCount === 'number'
          ? (childrenAllDeceasedText && childrenAliveCount > 0)
          : false;
        if (hasFatherConflict) conflicts.push('父亲字段同时包含“健康”与“已故”');
        if (hasMotherConflict) conflicts.push('母亲字段同时包含“健康”与“已故”');
        if (childrenCountConflict) conflicts.push('子女“已故”但“存活数＞0”，请核对');
        const tip = conflicts.length > 0 ? conflicts.join('；') : '未发现明显冲突';
        useAssistantStore.getState().setPanel({ conflictTip: tip });
        if (conflicts.length > 0) {
          message.warning(tip);
        } else {
          message.success(tip);
        }
        console.log('[Session] 家族史冲突检测', { father, mother, children, childrenAliveCount, childrenDeceasedCount, tip });
      };
      setActions({
        assessGeneticRisk,
        summarizeFamilyHistory,
        detectFamilyConflict,
        openDetailHelp
      });
    } else if (currentSection === 'chief_complaint') {
      setPanel({
        sampleInput: chiefComplaintText || '发热5天',
        recognition: {
          symptom: chiefComplaintValues?.symptom || '发热',
          duration: '5天'
        },
        normative: { good: '发热5天', bad: '发烧好几天了' },
        diseases: ['上感', '肺炎', '流感'],
        actions: ['智能完善', '示例库', '详细']
      });
      /**
       * improveChiefComplaint
       * 应用规范化主诉文本至表单（chiefComplaint.text），并同步识别症状
       */
      const improveChiefComplaint = () => {
        const st = useAssistantStore.getState();
        const normalized = st.panel.normative?.good || st.panel.sampleInput || (chiefComplaintText || '');
        const symptom = st.panel.recognition?.symptom || (chiefComplaintValues?.symptom || '');
        form.setFieldsValue({
          chiefComplaint: {
            ...(form.getFieldValue('chiefComplaint') || {}),
            text: normalized,
            symptom
          }
        });
        message.success('已应用规范化主诉');
        console.log('[Session] 已应用规范化主诉', { normalized, symptom });
      };
      /**
       * openExampleLibrary
       * 跳转到知识库页面并按当前症状进行搜索
       */
      const openExampleLibrary = () => {
        const st = useAssistantStore.getState();
        const symptom = st.panel.recognition?.symptom || (chiefComplaintValues?.symptom || '');
        const q = encodeURIComponent(symptom || '');
        navigate(`/knowledge?q=${q}`);
        console.log('[Session] 已跳转到示例库', { q });
      };
      /**
       * openDetailHelp
       * 跳转到知识库页面以查看详细规范与要点
       */
      const openDetailHelp = () => {
        const st = useAssistantStore.getState();
        const symptom = st.panel.recognition?.symptom || (chiefComplaintValues?.symptom || '');
        const q = encodeURIComponent(symptom || '');
        navigate(`/knowledge?q=${q}`);
        console.log('[Session] 已跳转到详细帮助', { q });
      };
      setActions({
        improveChiefComplaint,
        openExampleLibrary,
        openDetailHelp
      });
    }
  }, [currentSection, progress, birthPlace, occupationVal, phoneVal, chiefComplaintText, chiefComplaintValues, hpiAssociated, form, navigate, symptomContext?.relatedSymptoms, symptomContext?.redFlags, setModule, setProgress, setPanel, setActions]);

  // Navigation Handlers with Auto-Save
  const handleGoHome = async () => {
    // Attempt to save (skip validation to allow saving incomplete drafts)
    const saved = await handleSave(true);
    if (saved) {
        navigate('/');
    }
  };

  const handleGoInterviewStart = async () => {
    // Attempt to save (skip validation)
    const saved = await handleSave(true);
    if (saved) {
        navigate('/interview');
    }
  };

  const ageValue = Form.useWatch('age', form);
  const genderValue = Form.useWatch('gender', form);

  return (
    <>
    <InterviewLayout
      navigation={
        <NavigationPanel
          currentSection={currentSection}
          onSectionChange={setCurrentSection}
          sections={sections}
          progress={progress}
          onExport={handleExport}
          onGoHome={handleGoHome}
          onGoInterviewStart={handleGoInterviewStart}
        />
      }
      editor={
        <Spin spinning={loading}>
            <EditorPanel
              currentSection={currentSection}
              form={form}
            />
        </Spin>
      }
      knowledge={
        <KnowledgePanel
          activeSection={currentSection}
          loading={knowledgeLoading}
          symptomContext={symptomContext || undefined}
          patientInfo={{ age: ageValue, gender: genderValue }}
          sessionId={Number.isFinite(Number(id)) ? Number(id) : undefined}
        />
      }
    />
    <AssistantOverlay />
    <Modal
        title="标准化病历预览"
        open={reportVisible}
        onCancel={handleClosePreview}
        width={800}
        footer={[
            <Button key="copy" onClick={handleCopyReport}>复制到剪贴板</Button>,
            <Button key="download" onClick={handleDownloadReport}>下载 TXT</Button>,
            <Button key="close" type="primary" onClick={handleClosePreview}>关闭</Button>
        ]}
    >
        <div style={{ whiteSpace: 'pre-wrap', maxHeight: '60vh', overflowY: 'auto', fontFamily: 'monospace', background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
            {reportContent}
        </div>
    </Modal>
    </>
  );
};

export default Session;
