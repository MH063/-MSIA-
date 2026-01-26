import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, message, Spin, Modal, Button } from 'antd';
import dayjs from 'dayjs';
import api, { type ApiResponse } from '../../utils/api';

import InterviewLayout from './components/Layout/InterviewLayout';
import NavigationPanel from './components/Navigation/NavigationPanel';
import type { SectionStatus } from './components/Navigation/NavigationPanel';
import EditorPanel from './components/Editor/EditorPanel';
import KnowledgePanel from './components/Knowledge/KnowledgePanel';

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
  "胸痛": "chest_pain",
  "眩晕": "dizziness",
  "咯血": "hemoptysis",
  "上消化道出血": "hematemesis"
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

const host = window.location.hostname;
const isProduction = import.meta.env.PROD;

const Session: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // Mapping State
  const [synonymMap, setSynonymMap] = useState<Record<string, string>>({});
  const [nameToKeyMap, setNameToKeyMap] = useState<Record<string, string>>({});
  const [mappingsLoaded, setMappingsLoaded] = useState(false);

  // Fetch Mappings
  useEffect(() => {
    api.get('/mapping/symptoms').then(res => {
      if (res.success && res.data) {
        setSynonymMap(res.data.synonyms);
        setNameToKeyMap(res.data.nameToKey);
        setMappingsLoaded(true);
      }
    });
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
    const url = isProduction ? '/api/knowledge/stream' : `http://${host}:4000/api/knowledge/stream`;
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
        const assocKeys = assocNames
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
          console.log('[Session] 主诉文本解析更新伴随症状', { text, assocNames, assocKeys: mergedAssoc });
        } else {
          console.log('[Session] 主诉文本解析未发现新增伴随症状', { text, assocNames });
        }
        const active = pickActiveSymptoms();
        if (active.length > 0) {
          await updateSymptomContext(active);
        } else {
          setSymptomContext(null);
          setKnowledgeLoading(false);
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
}, [chiefComplaintText, chiefComplaintValues, form, pickActiveSymptoms, updateSymptomContext, synonymMap]);

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
        />
      }
    />
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
