import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, message, Spin, Modal, Button, Space, Tooltip, Popconfirm } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, EyeOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api, { type ApiResponse, unwrapData } from '../../utils/api';

import InterviewLayout from './components/Layout/InterviewLayout';
import NavigationPanel from './components/Navigation/NavigationPanel';
import type { SectionStatus } from './components/Navigation/NavigationPanel';
import EditorPanel from './components/Editor/EditorPanel';
import AssistantOverlay from './components/Assistant/AssistantOverlay';
import { useAssistantStore, type ModuleKey } from '../../store/assistant.store';
import { buildHpiNarrative } from '../../utils/narrative';

type DateValue = string | number | Date | Dayjs | null | undefined;

interface FormValues {
  name?: string;
  gender?: string;
  age?: number;
  birthDate?: DateValue;
  ethnicity?: string;
  nativePlace?: string;
  placeOfBirth?: string;
  occupation?: string;
  employer?: string;
  address?: string;
  phone?: string;
  historian?: string;
  reliability?: string;
  historianRelationship?: string;
  generalInfo?: {
    admissionTime?: DateValue;
    recordTime?: DateValue;
  };
  chiefComplaint?: {
    text?: string;
    symptom?: string;
    durationNum?: number;
    durationUnit?: string;
  };
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
    admissionDiagnosis?: string;
    associatedSymptoms?: string[];
    associatedSymptomsDetails?: string;
    negativeSymptoms?: string;
    spirit?: string;
    sleep?: string;
    appetite?: string;
    strength?: string;
    weight?: string;
    urine_stool?: string;
    general_line?: string;
    hpi_evolution?: string;
    evolution?: string;
    narrative?: string;
  };
  pastHistory?: {
    generalHealth?: string;
    pmh_diseases?: string[];
    diseaseDetails?: Record<string, { year?: number; control?: string; medication?: string }>;
    pmh_trauma_surgery?: string;
    pmh_allergies?: string;
    hasAllergy?: 'yes' | 'no';
    allergyDetails?: string;
    pmh_infectious?: string;
    infectiousHistory?: string;
    pmh_other?: string;
    illnessHistory?: string;
    allergyHistory?: string;
    surgeryHistory?: string;
    transfusionHistory?: string;
    vaccinationHistory?: string;
    confirmedSymptoms?: string[];
    surgeries?: { date?: DateValue; location?: string; name?: string; outcome?: string }[];
    transfusions?: { date?: DateValue; reason?: string; amount?: string; reaction?: string }[];
    allergies?: { allergen?: string; substance?: string; reaction?: string; severity?: string }[];
    noAllergies?: boolean;
  };
  personalHistory?: {
    smoking_status?: string;
    smokingHistory?: string;
    cigarettesPerDay?: number;
    smokingYears?: number;
    smokingIndex?: number;
    quitSmokingYears?: number;
    alcohol_status?: string;
    drinkingHistory?: string;
    drinkVolume?: number;
    alcoholDegree?: number;
    drinkFreqPerWeek?: number;
    weeklyAlcoholGrams?: number;
    quitDrinkingYears?: number;
    social?: string;
    work_cond?: string;
    living_habits?: string;
    substances?: string;
    sexual_history?: string;
    occupationalExposure?: string;
  };
  maritalHistory?: {
    status?: string;
    marriage_age?: number;
    spouse_health?: string;
    children?: string;
    other?: string;
  };
  menstrualHistory?: {
    age?: number;
    duration?: number;
    cycle?: number;
    lmp?: string;
    lmp_date?: DateValue;
    flow?: string;
    pain?: string;
    isMenopause?: boolean;
    menopause_age?: number;
  };
  fertilityHistory?: {
    term?: number;
    preterm?: number;
    abortion?: number;
    living?: number;
    summary?: string;
    details?: string;
  };
  familyHistory?: {
    father?: string;
    mother?: string;
    siblings?: string;
    children?: string;
    genetic?: string;
    similar?: string;
    summary?: string;
  };
  reviewOfSystems?: Record<string, { symptoms?: string[]; details?: string }>;
  physicalExam?: {
    vitalSigns?: {
      temperature?: number;
      pulse?: number;
      respiration?: number;
      systolicBP?: number;
      diastolicBP?: number;
    };
    general?: { description?: string };
    skinMucosa?: string;
    lymphNodes?: string;
    head?: string;
    neck?: string;
    chest?: { thorax?: string; lungs?: string; heart?: string };
    abdomen?: string;
    anusGenitals?: string;
    spineLimbs?: string;
    neurological?: string;
    specialist?: string;
    specialistDepartment?: string;
  };
  auxiliaryExams?: {
      exams?: { name: string; date: DateValue; result: string; image?: string }[];
      summary?: string;
  };
}

const SECTIONS = [
  { key: 'general', label: '一般项目' },
  { key: 'chief_complaint', label: '主诉' },
  { key: 'hpi', label: '现病史' },
  { key: 'past_history', label: '既往史' },
  { key: 'personal_history', label: '个人史' },
  { key: 'marital_history', label: '婚育史' },
  { key: 'family_history', label: '家族史' },
  { key: 'review_of_systems', label: '系统回顾' },
  { key: 'physical_exam', label: '体格检查' },
  { key: 'specialist', label: '专科情况' },
  { key: 'auxiliary_exam', label: '辅助检查' },
];

/**
 * 获取本地症状映射降级方案
 * 当API调用失败时使用
 */
const getFallbackSymptomMappings = (): { nameToKey: Record<string, string>; keyToName: Record<string, string> } => {
  const commonSymptoms: Record<string, string> = {
    '头痛': 'headache',
    '头晕': 'dizziness',
    '胸痛': 'chest_pain',
    '腹痛': 'abdominal_pain',
    '发热': 'fever',
    '咳嗽': 'cough',
    '心悸': 'palpitation',
    '恶心': 'nausea',
    '呕吐': 'vomiting',
    '腹泻': 'diarrhea',
    '便秘': 'constipation',
    '乏力': 'fatigue',
    '消瘦': 'weight_loss',
    '水肿': 'edema',
    '皮疹': 'rash',
    '关节痛': 'joint_pain',
    '腰痛': 'back_pain',
    '呼吸困难': 'dyspnea',
    '失眠': 'insomnia',
    '多饮': 'polydipsia',
    '多尿': 'polyuria',
    '血尿': 'hematuria',
    '黑便': 'melena',
    '黄疸': 'jaundice',
    '抽搐': 'convulsion',
    '昏迷': 'coma',
    '眩晕': 'vertigo',
    '耳鸣': 'tinnitus',
    '视力模糊': 'blurred_vision',
    '吞咽困难': 'dysphagia',
    '咯血': 'hemoptysis',
    '便血': 'hematochezia',
  };

  const keyToName: Record<string, string> = {};
  Object.entries(commonSymptoms).forEach(([name, key]) => {
    keyToName[key] = name;
  });

  return {
    nameToKey: commonSymptoms,
    keyToName
  };
};

/**
 * 生成降级诊断建议
 * 当API调用失败时使用本地常见症状-疾病映射
 */
const generateFallbackDiagnoses = (symptoms: string[]): string[] => {
  const symptomDiseaseMap: Record<string, string[]> = {
    '头痛': ['偏头痛', '紧张性头痛', '高血压', '颅内病变'],
    '胸痛': ['冠心病', '心绞痛', '心肌梗死', '胸膜炎', '肋间神经痛'],
    '腹痛': ['急性胃肠炎', '消化性溃疡', '胆囊炎', '阑尾炎', '肠梗阻'],
    '发热': ['上呼吸道感染', '肺炎', '流感', '尿路感染'],
    '咳嗽': ['急性支气管炎', '肺炎', '慢性阻塞性肺病', '支气管哮喘'],
    '心悸': ['心律失常', '冠心病', '甲状腺功能亢进', '贫血'],
    '恶心': ['急性胃肠炎', '消化不良', '胃炎', '肝炎'],
    '呕吐': ['急性胃肠炎', '肠梗阻', '颅内压增高', '妊娠反应'],
    '腹泻': ['急性胃肠炎', '食物中毒', '肠易激综合征', '炎症性肠病'],
    '便秘': ['功能性便秘', '肠梗阻', '甲状腺功能减退', '药物副作用'],
    '头晕': ['高血压', '低血压', '贫血', '颈椎病', '耳石症'],
    '乏力': ['贫血', '甲状腺功能减退', '糖尿病', '慢性疲劳综合征'],
    '消瘦': ['糖尿病', '甲状腺功能亢进', '恶性肿瘤', '结核'],
    '水肿': ['心力衰竭', '肾病综合征', '肝硬化', '甲状腺功能减退'],
    '皮疹': ['过敏性皮炎', '湿疹', '荨麻疹', '药物疹', '病毒感染'],
    '关节痛': ['类风湿关节炎', '骨关节炎', '痛风', '系统性红斑狼疮'],
    '腰痛': ['腰椎间盘突出', '腰肌劳损', '肾结石', '骨质疏松'],
    '呼吸困难': ['哮喘', '慢性阻塞性肺病', '心力衰竭', '肺栓塞'],
    '失眠': ['神经衰弱', '焦虑症', '抑郁症', '睡眠呼吸暂停'],
    '多饮': ['糖尿病', '尿崩症', '干燥综合征'],
    '多尿': ['糖尿病', '尿路感染', '前列腺增生', '尿崩症'],
  };

  const suggestions = new Set<string>();
  
  symptoms.forEach(symptom => {
    const diseases = symptomDiseaseMap[symptom];
    if (diseases) {
      diseases.forEach(d => suggestions.add(d));
    }
  });

  // 如果没有匹配到，返回通用建议
  if (suggestions.size === 0) {
    return ['建议进一步检查明确诊断', '请结合体格检查和辅助检查', '必要时请专科会诊'];
  }

  return Array.from(suggestions).slice(0, 6);
};

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
  presentIllness?: FormValues['presentIllness'];
  pastHistory?: FormValues['pastHistory'];
  personalHistory?: FormValues['personalHistory'];
  maritalHistory?: FormValues['maritalHistory'];
  menstrualHistory?: FormValues['menstrualHistory'];
  fertilityHistory?: FormValues['fertilityHistory'];
  familyHistory?: FormValues['familyHistory'];
  reviewOfSystems?: FormValues['reviewOfSystems'];
  physicalExam?: FormValues['physicalExam'];
  auxiliaryExams?: FormValues['auxiliaryExams'];
  generalInfo?: Record<string, unknown>;
} & Record<string, unknown>;

const Session: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const setModule = useAssistantStore(s => s.setModule);
  const setProgress = useAssistantStore(s => s.setProgress);
  const setPanel = useAssistantStore(s => s.setPanel);
  const setNewMessage = useAssistantStore(s => s.setNewMessage);
  const setActions = useAssistantStore(s => s.setActions);
  const setKnowledgeContext = useAssistantStore(s => s.knowledge.setKnowledgeContext);
  const setDiagnosisSuggestions = useAssistantStore(s => s.knowledge.setDiagnosisSuggestions);
  const setKnowledgeMappings = useAssistantStore(s => s.knowledge.setKnowledgeMappings);
  const setKnowledgeLoading = useAssistantStore(s => s.knowledge.setKnowledgeLoading);
  const setKnowledgeError = useAssistantStore(s => s.knowledge.setKnowledgeError);

  // Fetch Mappings
  useEffect(() => {
    const load = async () => {
      type MappingPayload = { nameToKey: Record<string, string> };
      try {
        const res = await api.get('/mapping/symptoms') as ApiResponse<MappingPayload>;
        const payload = unwrapData<MappingPayload>(res);
        if (payload) {
          const inverted: Record<string, string> = {};
          for (const [name, key] of Object.entries(payload.nameToKey || {})) {
            if (key && name && !inverted[key]) inverted[key] = name;
          }
          setKnowledgeMappings({ nameToKey: payload.nameToKey || {}, keyToName: inverted });
          console.log('[Session] 症状映射加载成功');
        } else {
          console.warn('[Session] 症状映射数据为空，使用本地降级映射');
          // 降级方案：使用本地症状映射
          const fallbackMappings = getFallbackSymptomMappings();
          setKnowledgeMappings(fallbackMappings);
        }
      } catch (e) {
        console.error('[Session] 症状映射加载失败，使用本地降级映射', e);
        // 降级方案：使用本地症状映射
        const fallbackMappings = getFallbackSymptomMappings();
        setKnowledgeMappings(fallbackMappings);
        message.warning('症状映射加载失败，已使用本地备选方案');
      }
    };
    load();
  }, [setKnowledgeMappings]);
  
  const [loading, setLoading] = useState(false);
  const [isValidId, setIsValidId] = useState<boolean | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>('draft');
  const [currentSection, setCurrentSection] = useState('general');
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewPlainText, setPreviewPlainText] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const [sections, setSections] = useState<SectionStatus[]>(() => SECTIONS.map(s => ({
    key: s.key,
    label: s.label,
    isCompleted: false,
    status: 'not_started',
    progress: 0,
  })));
  const [progress, setLocalProgress] = useState(0);
  const autoSaveDebounceRef = useRef<number | null>(null);
  
  const labelBySectionKey = React.useMemo<Record<string, string>>(
    () => Object.fromEntries(SECTIONS.map(s => [s.key, s.label])),
    []
  );

  useEffect(() => {
    return () => {
      if (autoSaveDebounceRef.current) window.clearTimeout(autoSaveDebounceRef.current);
    };
  }, []);

  const getSectionResetFieldPaths = (sectionKey: string) => {
    const map: Record<string, (string | (string | number)[])[]> = {
      general: [
        'name',
        'gender',
        'age',
        'birthDate',
        'placeOfBirth',
        'ethnicity',
        'nativePlace',
        'occupation',
        'employer',
        'phone',
        'address',
        'historian',
        'reliability',
        'historianRelationship',
        ['generalInfo', 'admissionTime'],
        ['generalInfo', 'recordTime'],
      ],
      chief_complaint: [['chiefComplaint']],
      hpi: [['presentIllness']],
      past_history: [
        ['pastHistory', 'generalHealth'],
        ['pastHistory', 'pmh_diseases'],
        ['pastHistory', 'diseaseDetails'],
        ['pastHistory', 'infectiousHistory'],
        ['pastHistory', 'pmh_other'],
        ['pastHistory', 'illnessHistory'],
        ['pastHistory', 'surgeries'],
        ['pastHistory', 'transfusions'],
        ['pastHistory', 'allergies'],
        ['pastHistory', 'noAllergies'],
        ['pastHistory', 'vaccinationHistory'],
      ],
      personal_history: [
        ['personalHistory', 'birthplace'],
        ['personalHistory', 'residence'],
        ['personalHistory', 'epidemic_contact'],
        ['personalHistory', 'smoking_status'],
        ['personalHistory', 'cigarettesPerDay'],
        ['personalHistory', 'smokingYears'],
        ['personalHistory', 'quitSmokingYears'],
        ['personalHistory', 'smokingHistory'],
        ['personalHistory', 'smokingIndex'],
        ['personalHistory', 'alcohol_status'],
        ['personalHistory', 'drinkVolume'],
        ['personalHistory', 'alcoholDegree'],
        ['personalHistory', 'drinkFreqPerWeek'],
        ['personalHistory', 'weeklyAlcoholGrams'],
        ['personalHistory', 'quitDrinkingYears'],
        ['personalHistory', 'drinkingHistory'],
        ['personalHistory', 'social'],
        ['personalHistory', 'work_cond'],
        ['personalHistory', 'living_habits'],
        ['personalHistory', 'substances'],
        ['personalHistory', 'sexual_history'],
      ],
      marital_history: [['maritalHistory'], ['menstrualHistory'], ['fertilityHistory']],
      family_history: [['familyHistory']],
      physical_exam: [['physicalExam']],
      specialist: [['physicalExam', 'specialist'], ['physicalExam', 'specialistDepartment']],
      auxiliary_exam: [['auxiliaryExams']],
      review_of_systems: [['reviewOfSystems']],
    };
    return map[sectionKey] || [];
  };

  useEffect(() => {
    const t = window.setInterval(() => setClockTick(x => x + 1), 15000);
    return () => window.clearInterval(t);
  }, []);

  const formatRelativeTime = useCallback((ts: number) => {
    const diffMs = Date.now() - ts;
    if (diffMs < 10 * 1000) return '刚刚';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}秒前`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}天前`;
  }, []);

  const handleSectionChange = async (key: string) => {
    // 先保存当前板块数据
    if (isValidId && id && id !== 'new') {
      try {
        console.log('[Session] 板块切换前自动保存');
        await handleSave(true, true);
      } catch (e) {
        console.error('[Session] 板块切换自动保存失败', e);
      }
    }
    
    setCurrentSection(key);
    
    // Map section keys to store module names
    const moduleMap: Partial<Record<string, ModuleKey>> = {
      'general': 'general',
      'chief_complaint': 'chief_complaint',
      'hpi': 'hpi',
      'past_history': 'past_history',
      'personal_history': 'personal_history',
      'marital_history': 'marital_history',
      'family_history': 'family_history',
      'review_of_systems': 'review_of_systems',
    };
    
    const mod = moduleMap[key];
    if (mod) setModule(mod, labelBySectionKey[key] || '');
  };

  const watchedCcText = Form.useWatch(['chiefComplaint', 'text'], form) as string | undefined;
  const watchedGender = Form.useWatch('gender', form) as string | undefined;
  const watchedAge = Form.useWatch('age', form) as number | undefined;
  const knowledgeContext = useAssistantStore(s => s.knowledge.context);

  const hasAssistantValue = React.useCallback((x: unknown): boolean => {
    if (x === 0) return true;
    if (x === null || x === undefined) return false;
    if (dayjs.isDayjs(x)) return true;
    if (Array.isArray(x)) return x.some(hasAssistantValue);
    if (typeof x === 'object') return Object.values(x as Record<string, unknown>).some(hasAssistantValue);
    if (typeof x === 'string') return x.trim().length > 0;
    return Boolean(x);
  }, []);

  const getPendingItemsForSection = React.useCallback((sectionKey: string) => {
    type FieldPath = string | number | (string | number)[];
    const map: Record<string, Array<{ label: string; path: FieldPath }>> = {
      general: [
        { label: '姓名', path: 'name' },
        { label: '性别', path: 'gender' },
        { label: '年龄', path: 'age' },
        { label: '联系电话', path: 'phone' },
        { label: '现住址', path: 'address' },
        { label: '职业', path: 'occupation' },
      ],
      chief_complaint: [
        { label: '主诉描述', path: ['chiefComplaint', 'text'] },
        { label: '症状', path: ['chiefComplaint', 'symptom'] },
        { label: '持续时间', path: ['chiefComplaint', 'durationNum'] },
      ],
      hpi: [
        { label: '起病方式', path: ['presentIllness', 'onsetMode'] },
        { label: '起病时间', path: ['presentIllness', 'onsetTime'] },
        { label: '部位', path: ['presentIllness', 'location'] },
        { label: '程度', path: ['presentIllness', 'severity'] },
        { label: '演变', path: ['presentIllness', 'hpi_evolution'] },
        { label: '诊治经过', path: ['presentIllness', 'treatmentHistory'] },
      ],
      past_history: [
        { label: '既往健康状况', path: ['pastHistory', 'generalHealth'] },
        { label: '过敏史', path: ['pastHistory', 'allergies'] },
        { label: '手术史', path: ['pastHistory', 'surgeries'] },
        { label: '输血史', path: ['pastHistory', 'transfusions'] },
      ],
      personal_history: [
        { label: '居住地', path: ['personalHistory', 'residence'] },
        { label: '吸烟', path: ['personalHistory', 'smoking_status'] },
        { label: '饮酒', path: ['personalHistory', 'alcohol_status'] },
        { label: '职业暴露', path: ['personalHistory', 'work_cond'] },
      ],
      marital_history: [
        { label: '婚育史', path: ['maritalHistory'] },
      ],
      family_history: [
        { label: '家族史', path: ['familyHistory'] },
      ],
      review_of_systems: [
        { label: '系统回顾', path: ['reviewOfSystems'] },
      ],
      physical_exam: [
        { label: '体格检查', path: ['physicalExam'] },
      ],
      specialist: [
        { label: '专科情况', path: ['physicalExam', 'specialist'] },
      ],
      auxiliary_exam: [
        { label: '辅助检查', path: ['auxiliaryExams'] },
      ],
    };

    const items = map[sectionKey] || [];
    const missing = items
      .filter((it) => !hasAssistantValue(form.getFieldValue(it.path)))
      .map((it) => it.label);
    return missing;
  }, [form, hasAssistantValue]);

  const updateAssistantPanelForSection = React.useCallback((sectionKey: string, notify: boolean) => {
    const pendingItems = getPendingItemsForSection(sectionKey);
    const validationText = pendingItems.length > 0
      ? `当前模块待补充：${pendingItems.join('、')}`
      : '当前模块已填写较完整';

    setPanel({
      pendingItems,
      validationText
    });
    if (notify) setNewMessage(true);
    console.log('[Session] 助手面板刷新', { sectionKey, pendingCount: pendingItems.length });
  }, [getPendingItemsForSection, setNewMessage, setPanel]);

  const analyzeChiefComplaint = React.useCallback(async (rawText: string, options: { writeBack: boolean; notify: boolean }) => {
    const text = String(rawText || '').trim();
    if (!text) {
      if (options.notify) message.warning('请先填写主诉内容');
      return;
    }

    type SymptomKnowledgeLite = {
      symptomKey: string;
      displayName: string;
      requiredQuestions: unknown;
      associatedSymptoms?: unknown;
      redFlags?: unknown;
      physicalSigns?: unknown;
      updatedAt?: string;
    };

    type NlpPayload = {
      matchedCount: number;
      matchedSymptoms: Array<{ name: string; key: string; knowledge: SymptomKnowledgeLite | null }>;
      duration?: { value: number | null; unit: string | null };
      normalizedComplaint?: string;
      originalText?: string;
    };

    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      console.log('[Session] 解析主诉', { text });
      const res = await api.post('/nlp/analyze', { text }) as ApiResponse<NlpPayload>;
      const payload = unwrapData<NlpPayload>(res);
      if (!payload) return;

      const names = (payload.matchedSymptoms || []).map(s => s.name).filter(Boolean);
      const symptomText = names.join('、');
      const durationText = payload.duration?.value ? `${payload.duration.value}${payload.duration.unit || ''}` : '';
      const normalized = String(payload.normalizedComplaint || '').trim();

      setPanel({
        sampleInput: text,
        recognition: { symptom: symptomText, duration: durationText },
        normative: normalized ? { good: normalized, bad: text } : undefined,
      });

      if (options.writeBack && payload.matchedSymptoms?.[0]?.name) {
        const first = payload.matchedSymptoms[0];
        form.setFieldValue(['chiefComplaint', 'symptom'], first.name);
        if (payload.duration?.value && payload.duration.unit) {
          form.setFieldValue(['chiefComplaint', 'durationNum'], payload.duration.value);
          form.setFieldValue(['chiefComplaint', 'durationUnit'], payload.duration.unit);
        }
        console.log('[Session] 主诉字段回填', { symptom: first.name, duration: payload.duration });
      }

      const best = payload.matchedSymptoms?.find(s => s.knowledge) || payload.matchedSymptoms?.[0];
      if (best?.key) {
        let k = best.knowledge;
        if (!k) {
          try {
            const kRes = await api.get(`/knowledge/${best.key}`) as ApiResponse<SymptomKnowledgeLite>;
            k = unwrapData<SymptomKnowledgeLite>(kRes) || null;
          } catch (e) {
            console.warn('[Session] 获取知识库失败', e);
          }
        }

        if (k) {
          const toArr = (v: unknown): string[] => Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : [];
          setKnowledgeContext({
            name: k.displayName || best.name,
            questions: toArr(k.requiredQuestions),
            relatedSymptoms: toArr(k.associatedSymptoms),
            redFlags: toArr(k.redFlags),
            physicalSigns: toArr(k.physicalSigns),
            updatedAt: k.updatedAt,
          });
          console.log('[Session] 知识库上下文更新', { symptomKey: best.key, name: k.displayName });
        } else {
          setKnowledgeContext(null);
          setKnowledgeError('暂无对应的知识库条目');
        }
      } else {
        setKnowledgeContext(null);
      }

      const sessionId = (() => {
        const n = Number(id);
        return Number.isFinite(n) ? n : null;
      })();
      if (sessionId && names.length > 0) {
        try {
          const sRes = await api.post('/diagnosis/suggest', { symptoms: names, age: watchedAge, gender: watchedGender, sessionId }) as ApiResponse<string[]>;
          const suggestions = unwrapData<string[]>(sRes);
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            setDiagnosisSuggestions(suggestions);
            setPanel({ diseases: suggestions });
            console.log('[Session] 诊断建议更新', { count: suggestions.length });
          } else {
            // 降级方案：使用本地常见疾病列表
            const fallbackSuggestions = generateFallbackDiagnoses(names);
            setDiagnosisSuggestions(fallbackSuggestions);
            setPanel({ diseases: fallbackSuggestions });
            console.log('[Session] 使用本地降级诊断建议', { count: fallbackSuggestions.length });
          }
        } catch (e) {
          console.warn('[Session] 获取诊断建议失败，使用本地降级方案', e);
          // 降级方案：使用本地常见疾病列表
          const fallbackSuggestions = generateFallbackDiagnoses(names);
          setDiagnosisSuggestions(fallbackSuggestions);
          setPanel({ diseases: fallbackSuggestions });
          message.warning('诊断建议获取失败，已使用本地备选方案');
        }
      } else {
        setDiagnosisSuggestions([]);
      }

      if (options.notify) setNewMessage(true);
    } catch (e) {
      console.error('[Session] 解析主诉失败', e);
      if (options.notify) message.error('主诉解析失败');
      setKnowledgeError('主诉解析失败');
    } finally {
      setKnowledgeLoading(false);
    }
  }, [form, id, setDiagnosisSuggestions, setKnowledgeContext, setKnowledgeError, setKnowledgeLoading, setNewMessage, setPanel, watchedAge, watchedGender]);

  useEffect(() => {
    updateAssistantPanelForSection(currentSection, false);
  }, [currentSection, updateAssistantPanelForSection]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (currentSection === 'chief_complaint' && watchedCcText && watchedCcText.trim().length >= 2) {
        analyzeChiefComplaint(watchedCcText, { writeBack: false, notify: false });
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [analyzeChiefComplaint, currentSection, watchedCcText]);

  const assistantImproveChiefComplaint = useCallback(async () => {
    const text = String(form.getFieldValue(['chiefComplaint', 'text']) || '').trim();
    await analyzeChiefComplaint(text, { writeBack: true, notify: true });
  }, [analyzeChiefComplaint, form]);

  const assistantCheckCompleteness = useCallback(() => {
    updateAssistantPanelForSection(currentSection, true);
  }, [currentSection, updateAssistantPanelForSection]);

  const assistantOpenHelp = useCallback(() => {
    const pending = getPendingItemsForSection(currentSection);
    Modal.info({
      title: '智能问诊助手帮助',
      content: (
        <div>
          <div>当前模块：{labelBySectionKey[currentSection] || currentSection}</div>
          <div>建议优先补充：{pending.length > 0 ? pending.join('、') : '暂无'}</div>
        </div>
      ),
      okText: '知道了'
    });
    console.log('[Session] 打开助手帮助', { currentSection, pendingCount: pending.length });
  }, [currentSection, getPendingItemsForSection, labelBySectionKey]);

  const assistantRemindRedFlags = useCallback(() => {
    const flags = knowledgeContext?.redFlags || [];
    if (Array.isArray(flags) && flags.length > 0) {
      setPanel({ redFlagsTip: `红旗征：${flags.slice(0, 6).join('、')}` });
      setNewMessage(true);
      console.log('[Session] 红旗征提醒', { count: flags.length });
    } else {
      message.info('暂无红旗征提示');
    }
  }, [knowledgeContext?.redFlags, setNewMessage, setPanel]);

  const assistantGuideReviewOfSystems = useCallback(() => {
    const qs = knowledgeContext?.questions || [];
    if (Array.isArray(qs) && qs.length > 0) {
      setPanel({ tips: qs.slice(0, 6) });
      setNewMessage(true);
      console.log('[Session] 系统回顾引导', { count: qs.length });
    } else {
      message.info('暂无引导要点');
    }
  }, [knowledgeContext?.questions, setNewMessage, setPanel]);

  /**
   * 智能补全既往史
   * 根据已填写的疾病信息，自动完善疾病详情
   */
  const assistantCompletePastHistory = useCallback(() => {
    const pastHistory = form.getFieldValue('pastHistory') as FormValues['pastHistory'];
    const diseases = pastHistory?.pmh_diseases || [];
    
    if (diseases.length === 0) {
      message.info('请先选择既往疾病');
      return;
    }

    const diseaseDetails = pastHistory?.diseaseDetails || {};
    const updatedDetails = { ...diseaseDetails };
    
    diseases.forEach(disease => {
      if (!updatedDetails[disease]) {
        updatedDetails[disease] = {
          year: new Date().getFullYear() - Math.floor(Math.random() * 5 + 1),
          control: '控制良好',
          medication: '规律用药'
        };
      }
    });

    form.setFieldValue(['pastHistory', 'diseaseDetails'], updatedDetails);
    setPanel({ 
      tips: [`已完善 ${diseases.length} 项疾病详情`, '请根据实际情况修改具体信息'],
      validationText: '既往史智能补全完成，请核对信息准确性'
    });
    setNewMessage(true);
    message.success('既往史智能补全完成');
    console.log('[Session] 既往史智能补全', { diseases: diseases.length });
  }, [form, setNewMessage, setPanel]);

  /**
   * 校验婚育史信息
   * 检查婚育史填写的逻辑一致性
   */
  const assistantValidateMaritalHistory = useCallback(() => {
    const maritalHistory = form.getFieldValue('maritalHistory') as FormValues['maritalHistory'];
    const menstrualHistory = form.getFieldValue('menstrualHistory') as FormValues['menstrualHistory'];
    const fertilityHistory = form.getFieldValue('fertilityHistory') as FormValues['fertilityHistory'];
    const gender = form.getFieldValue('gender') as string;
    
    const validations: string[] = [];
    
    if (gender === '女') {
      if (!menstrualHistory?.age && !menstrualHistory?.isMenopause) {
        validations.push('女性患者建议填写月经史');
      }
      if (maritalHistory?.status === 'married' && !fertilityHistory?.term && !fertilityHistory?.living) {
        validations.push('已婚女性建议填写生育史');
      }
    }
    
    if (maritalHistory?.status === 'married' && !maritalHistory.marriage_age) {
      validations.push('已婚建议填写结婚年龄');
    }
    
    if (validations.length > 0) {
      setPanel({ 
        maritalValidation: `婚育史校验提醒：${validations.join('；')}`,
        tips: validations
      });
      setNewMessage(true);
      message.warning('婚育史信息需要完善');
    } else {
      setPanel({ 
        maritalValidation: '婚育史信息填写完整',
        tips: ['婚育史信息填写完整']
      });
      setNewMessage(true);
      message.success('婚育史校验通过');
    }
    console.log('[Session] 婚育史校验', { validations: validations.length });
  }, [form, setNewMessage, setPanel]);

  /**
   * 生成家族史摘要
   * 根据家族史信息生成结构化摘要
   */
  const assistantSummarizeFamilyHistory = useCallback(() => {
    const familyHistory = form.getFieldValue('familyHistory') as FormValues['familyHistory'];
    
    if (!familyHistory || Object.keys(familyHistory).length === 0) {
      message.info('请先填写家族史信息');
      return;
    }

    const parts: string[] = [];
    if (familyHistory.father) parts.push(`父亲：${familyHistory.father}`);
    if (familyHistory.mother) parts.push(`母亲：${familyHistory.mother}`);
    if (familyHistory.siblings) parts.push(`兄弟姐妹：${familyHistory.siblings}`);
    if (familyHistory.children) parts.push(`子女：${familyHistory.children}`);
    if (familyHistory.genetic) parts.push(`遗传病史：${familyHistory.genetic}`);
    if (familyHistory.similar) parts.push(`类似疾病：${familyHistory.similar}`);

    const summary = parts.length > 0 ? parts.join('；') : '暂无家族史记录';
    
    form.setFieldValue(['familyHistory', 'summary'], summary);
    setPanel({ 
      familySummary: summary,
      tips: parts.length > 0 ? ['家族史摘要已生成'] : ['请完善家族史各成员信息']
    });
    setNewMessage(true);
    message.success('家族史摘要生成完成');
    console.log('[Session] 家族史摘要生成', { parts: parts.length });
  }, [form, setNewMessage, setPanel]);

  /**
   * 检测家族史冲突
   * 检查家族史中可能存在的逻辑冲突
   */
  const assistantDetectFamilyConflict = useCallback(() => {
    const familyHistory = form.getFieldValue('familyHistory') as FormValues['familyHistory'];
    const conflicts: string[] = [];
    
    if (familyHistory?.genetic?.includes('无') && familyHistory?.similar?.includes('有')) {
      conflicts.push('遗传病史与类似疾病记录存在矛盾');
    }
    
    if (familyHistory?.father?.includes('健康') && familyHistory?.mother?.includes('健康') && 
        familyHistory?.genetic?.includes('有')) {
      conflicts.push('父母均健康但记录有遗传病史，请核实');
    }

    if (conflicts.length > 0) {
      setPanel({ 
        conflictTip: `家族史冲突检测：${conflicts.join('；')}`,
        tips: conflicts
      });
      setNewMessage(true);
      message.warning('检测到家族史可能存在冲突');
    } else {
      setPanel({ 
        conflictTip: '家族史记录未发现明显冲突',
        tips: ['家族史记录逻辑一致']
      });
      setNewMessage(true);
      message.success('家族史冲突检测通过');
    }
    console.log('[Session] 家族史冲突检测', { conflicts: conflicts.length });
  }, [form, setNewMessage, setPanel]);

  /**
   * 遗传风险评估
   * 基于家族史评估遗传风险
   */
  const assistantAssessGeneticRisk = useCallback(() => {
    const familyHistory = form.getFieldValue('familyHistory') as FormValues['familyHistory'];
    
    if (!familyHistory) {
      message.info('请先填写家族史信息');
      return;
    }

    const riskFactors: string[] = [];
    const geneticDiseases = ['糖尿病', '高血压', '冠心病', '肿瘤', '精神疾病'];
    
    const allText = [
      familyHistory.father,
      familyHistory.mother,
      familyHistory.siblings,
      familyHistory.genetic,
      familyHistory.similar
    ].filter(Boolean).join(' ');

    geneticDiseases.forEach(disease => {
      if (allText.includes(disease)) {
        riskFactors.push(disease);
      }
    });

    const riskLevel = riskFactors.length >= 3 ? '高风险' : riskFactors.length >= 1 ? '中风险' : '低风险';
    const tip = riskFactors.length > 0 
      ? `遗传风险评估：${riskLevel}。家族史中涉及：${riskFactors.join('、')}`
      : '遗传风险评估：未发现明显遗传风险因素';

    setPanel({ 
      geneticRiskTip: tip,
      tips: riskFactors.length > 0 ? [`发现${riskFactors.length}项遗传风险因素`] : ['未发现明显遗传风险']
    });
    setNewMessage(true);
    message.success('遗传风险评估完成');
    console.log('[Session] 遗传风险评估', { riskLevel, factors: riskFactors.length });
  }, [form, setNewMessage, setPanel]);

  /**
   * 职业暴露提示
   * 根据职业信息提示可能的职业暴露风险
   */
  const assistantSuggestOccupationalExposure = useCallback(() => {
    const occupation = form.getFieldValue('occupation') as string;
    
    if (!occupation) {
      message.info('请先填写职业信息');
      return;
    }

    const exposureMap: Record<string, string[]> = {
      '矿工': ['粉尘暴露', '矽肺风险', '通风不良'],
      '化工': ['化学品接触', '皮肤刺激', '呼吸道刺激'],
      '医护': ['感染风险', '针刺伤', '化学消毒剂'],
      '教师': ['嗓音疲劳', '粉尘', '久坐'],
      '司机': ['久坐', '腰椎问题', '噪音'],
      '厨师': ['高温', '油烟', '烫伤风险'],
      '建筑': ['高空作业', '粉尘', '噪音'],
      '纺织': ['噪音', '纤维粉尘', '重复性劳损']
    };

    const exposures = Object.entries(exposureMap).find(([key]) => occupation.includes(key))?.[1] || 
      ['建议关注职业相关健康风险'];

    const tip = `职业暴露提示（${occupation}）：${exposures.join('、')}`;
    
    form.setFieldValue(['personalHistory', 'occupationalExposure'], tip);
    setPanel({ 
      occupationalExposureTip: tip,
      tips: exposures.map(e => `职业暴露：${e}`)
    });
    setNewMessage(true);
    message.success('职业暴露提示已生成');
    console.log('[Session] 职业暴露提示', { occupation, exposures: exposures.length });
  }, [form, setNewMessage, setPanel]);

  /**
   * 妊娠红旗征提示
   * 针对女性患者提示妊娠相关红旗征
   */
  const assistantShowPregnancyRedFlags = useCallback(() => {
    const gender = form.getFieldValue('gender') as string;
    const menstrualHistory = form.getFieldValue('menstrualHistory') as FormValues['menstrualHistory'];
    
    if (gender !== '女') {
      message.info('该功能仅适用于女性患者');
      return;
    }

    const redFlags: string[] = [];
    
    if (menstrualHistory?.isMenopause === false || !menstrualHistory?.isMenopause) {
      redFlags.push('育龄期女性需询问末次月经');
      redFlags.push('需排除妊娠可能');
    }
    
    if (menstrualHistory?.lmp_date) {
      const lmp = dayjs(menstrualHistory.lmp_date);
      const weeks = dayjs().diff(lmp, 'week');
      if (weeks > 40) {
        redFlags.push('停经超过40周，需评估妊娠状态');
      }
    }

    const tip = redFlags.length > 0 
      ? `妊娠红旗征：${redFlags.join('；')}`
      : '妊娠相关红旗征：暂无特殊提示';

    setPanel({ 
      pregnancyRedFlagsTip: tip,
      tips: redFlags.length > 0 ? redFlags : ['妊娠风险评估正常']
    });
    setNewMessage(true);
    message.success('妊娠红旗征提示已生成');
    console.log('[Session] 妊娠红旗征提示', { flags: redFlags.length });
  }, [form, setNewMessage, setPanel]);

  /**
   * 个人史智能提示
   * 根据个人史填写情况提供智能建议
   */
  const assistantShowPersonalHints = useCallback(() => {
    const personalHistory = form.getFieldValue('personalHistory') as FormValues['personalHistory'];
    const hints: string[] = [];

    if (!personalHistory?.smoking_status) {
      hints.push('建议询问吸烟史');
    } else if (personalHistory.smoking_status !== 'never' && !personalHistory.smokingIndex) {
      hints.push('吸烟者建议计算吸烟指数');
    }

    if (!personalHistory?.alcohol_status) {
      hints.push('建议询问饮酒史');
    }

    if (!personalHistory?.living_habits) {
      hints.push('建议了解起居饮食习惯');
    }

    setPanel({ 
      tips: hints.length > 0 ? hints : ['个人史信息填写较完整'],
      guidance: ['个人史智能提示已更新']
    });
    setNewMessage(true);
    console.log('[Session] 个人史智能提示', { hints: hints.length });
  }, [form, setNewMessage, setPanel]);

  useEffect(() => {
    setActions({
      improveChiefComplaint: assistantImproveChiefComplaint,
      checkHpiCompleteness: assistantCheckCompleteness,
      openDetailHelp: assistantOpenHelp,
      remindRedFlags: assistantRemindRedFlags,
      guideReviewOfSystems: assistantGuideReviewOfSystems,
      completePastHistory: assistantCompletePastHistory,
      validateMaritalHistory: assistantValidateMaritalHistory,
      summarizeFamilyHistory: assistantSummarizeFamilyHistory,
      detectFamilyConflict: assistantDetectFamilyConflict,
      assessGeneticRisk: assistantAssessGeneticRisk,
      suggestOccupationalExposure: assistantSuggestOccupationalExposure,
      showPregnancyRedFlags: assistantShowPregnancyRedFlags,
      showPersonalHints: assistantShowPersonalHints,
      startVoiceInput: () => message.info('语音输入功能待接入'),
      addAssociatedFromKnowledge: (key: string) => {
        const k = String(key || '').trim();
        if (!k) return;
        const curr = (form.getFieldValue(['presentIllness', 'associatedSymptoms']) || []) as unknown;
        const arr = Array.isArray(curr) ? curr.map(x => String(x)) : [];
        if (!arr.includes(k)) {
          form.setFieldValue(['presentIllness', 'associatedSymptoms'], [...arr, k]);
          setNewMessage(true);
          console.log('[Session] 追加伴随症状', { key: k });
        }
      }
    });
  }, [
    assistantCheckCompleteness,
    assistantGuideReviewOfSystems,
    assistantImproveChiefComplaint,
    assistantOpenHelp,
    assistantRemindRedFlags,
    assistantCompletePastHistory,
    assistantValidateMaritalHistory,
    assistantSummarizeFamilyHistory,
    assistantDetectFamilyConflict,
    assistantAssessGeneticRisk,
    assistantSuggestOccupationalExposure,
    assistantShowPregnancyRedFlags,
    assistantShowPersonalHints,
    form,
    setActions,
    setNewMessage,
  ]);

  /**
   * 计算表单完成度
   * 使用加权算法，根据各板块重要性和填写完整度计算总体进度
   */
  const computeCompletion = useCallback((values: FormValues) => {
    /**
     * 检查值是否有效
     */
    const hasValidValue = (x: unknown): boolean => {
      if (x === 0) return true;
      if (x === null || x === undefined) return false;
      if (dayjs.isDayjs(x)) return x.isValid();
      if (Array.isArray(x)) return x.length > 0 && x.some(hasValidValue);
      if (typeof x === 'object') {
        const vals = Object.values(x as Record<string, unknown>);
        return vals.length > 0 && vals.some(hasValidValue);
      }
      if (typeof x === 'string') return x.trim().length > 0 && !/^[-—无暂无]+$/u.test(x.trim());
      return Boolean(x);
    };

    type FieldPath = string | number | (string | number)[];
    const getValueAtPath = (obj: unknown, path: FieldPath): unknown => {
      if (!obj) return undefined;
      if (Array.isArray(path)) {
        const isIndexable = (v: unknown): v is Record<PropertyKey, unknown> => typeof v === 'object' && v !== null;
        let cur: unknown = obj;
        for (const seg of path) {
          if (!isIndexable(cur)) return undefined;
          cur = cur[seg as PropertyKey];
        }
        return cur;
      }
      if (typeof obj !== 'object' || obj === null) return undefined;
      return (obj as Record<PropertyKey, unknown>)[path as PropertyKey];
    };

    const getSectionStartFieldPaths = (sectionKey: string): FieldPath[] => {
      const map: Record<string, FieldPath[]> = {
        general: ['name', 'gender', 'age', 'phone', 'address', 'occupation'],
        chief_complaint: [['chiefComplaint', 'text'], ['chiefComplaint', 'symptom']],
        hpi: [
          ['presentIllness', 'onsetMode'],
          ['presentIllness', 'onsetTime'],
          ['presentIllness', 'location'],
          ['presentIllness', 'severity'],
          ['presentIllness', 'treatmentHistory'],
          ['presentIllness', 'hpi_evolution'],
          ['presentIllness', 'evolution'],
          ['presentIllness', 'narrative'],
        ],
        past_history: [
          ['pastHistory', 'pmh_diseases'],
          ['pastHistory', 'pmh_other'],
          ['pastHistory', 'infectiousHistory'],
          ['pastHistory', 'surgeries'],
          ['pastHistory', 'transfusions'],
          ['pastHistory', 'allergies'],
          ['pastHistory', 'noAllergies'],
          ['pastHistory', 'vaccinationHistory'],
        ],
        personal_history: [
          ['personalHistory', 'smoking_status'],
          ['personalHistory', 'alcohol_status'],
          ['personalHistory', 'living_habits'],
          ['personalHistory', 'work_cond'],
        ],
        marital_history: [['maritalHistory', 'status'], ['menstrualHistory'], ['fertilityHistory']],
        family_history: [
          ['familyHistory', 'father'],
          ['familyHistory', 'mother'],
          ['familyHistory', 'siblings'],
          ['familyHistory', 'children'],
          ['familyHistory', 'genetic'],
          ['familyHistory', 'similar'],
          ['familyHistory', 'summary'],
        ],
        review_of_systems: [['reviewOfSystems']],
        physical_exam: [['physicalExam', 'vitalSigns']],
        specialist: [['physicalExam', 'specialist'], ['physicalExam', 'specialistDepartment']],
        auxiliary_exam: [['auxiliaryExams']],
      };
      return map[sectionKey] || [];
    };

    const isSectionStarted = (sectionKey: string): boolean => {
      const paths = getSectionStartFieldPaths(sectionKey);
      for (const p of paths) {
        if (hasValidValue(getValueAtPath(values, p))) return true;
      }
      return false;
    };

    /**
     * 计算单个板块的完成度（0-1之间）
     */
    const calculateSectionProgress = (key: string): number => {
      switch (key) {
        case 'general': {
          const requiredFields = [values.name, values.gender, values.age, values.historian];
          const optionalFields = [
            values.phone,
            values.address,
            values.occupation,
            values.ethnicity,
            values.placeOfBirth,
            values.nativePlace,
          ];
          const requiredScore = requiredFields.filter(hasValidValue).length / requiredFields.length;
          const optionalScore = optionalFields.filter(hasValidValue).length / optionalFields.length * 0.2;
          return Math.min(1, requiredScore + optionalScore);
        }
        case 'chief_complaint': {
          if (hasValidValue(values.chiefComplaint?.text)) return 1;
          if (hasValidValue(values.chiefComplaint?.symptom)) return 1;
          return 0;
        }
        case 'hpi': {
          const pi = values.presentIllness || {};
          const evolution = pi.hpi_evolution ?? pi.evolution ?? pi.narrative;
          const keyFields = [
            pi.onsetMode,
            pi.onsetTime,
            pi.location,
            pi.severity,
            pi.treatmentHistory,
            evolution,
          ];
          const filledCount = keyFields.filter(hasValidValue).length;
          return filledCount / keyFields.length;
        }
        case 'past_history': {
          const ph = values.pastHistory || {};
          const hasDiseases =
            hasValidValue(ph.pmh_diseases) ||
            hasValidValue(ph.illnessHistory) ||
            hasValidValue(ph.infectiousHistory) ||
            hasValidValue(ph.pmh_other);
          const hasAllergies =
            (Array.isArray(ph.allergies) && ph.allergies.length > 0) ||
            Boolean(ph.noAllergies);
          const hasGeneralHealth = hasValidValue(ph.generalHealth);
          const scores = [hasGeneralHealth, hasDiseases, hasAllergies];
          return scores.filter(Boolean).length / scores.length;
        }
        case 'personal_history': {
          const pe = values.personalHistory || {};
          const hasSmoking = hasValidValue(pe.smoking_status);
          const hasAlcohol = hasValidValue(pe.alcohol_status);
          const hasHabits = hasValidValue(pe.living_habits);
          const scores = [hasSmoking, hasAlcohol, hasHabits];
          return scores.filter(Boolean).length / scores.length;
        }
        case 'marital_history': {
          // 婚育史：婚姻状况、月经史（女性）、生育史
          const mh = values.maritalHistory;
          const men = values.menstrualHistory;
          const fh = values.fertilityHistory;
          const hasMarital = hasValidValue(mh?.status);
          const hasMenstrual = values.gender !== '女' || hasValidValue(men?.age) || men?.isMenopause;
          const hasFertility = hasValidValue(fh) || values.gender !== '女';
          const scores = [hasMarital, hasMenstrual, hasFertility];
          return scores.filter(Boolean).length / scores.length;
        }
        case 'family_history': {
          const fh = values.familyHistory || {};
          const hasParents = hasValidValue(fh.father) || hasValidValue(fh.mother);
          const hasGenetic = hasValidValue(fh.genetic) || hasValidValue(fh.similar);
          const hasSummary = hasValidValue(fh.summary);
          return hasParents || hasGenetic || hasSummary ? 1 : 0;
        }
        case 'review_of_systems': {
          const ros = values.reviewOfSystems || {};
          const systems = Object.values(ros);
          return systems.some(sys => hasValidValue(sys)) ? 1 : 0;
        }
        case 'physical_exam': {
          const vs = values.physicalExam?.vitalSigns || {};
          const vitalFields = [vs.temperature, vs.pulse, vs.respiration, vs.systolicBP, vs.diastolicBP];
          const vitalScore = vitalFields.filter(hasValidValue).length / vitalFields.length;
          const hasGeneral = hasValidValue(values.physicalExam?.general?.description);
          return Math.min(1, vitalScore + (hasGeneral ? 0.2 : 0));
        }
        case 'specialist': {
          const hasSpecialist = hasValidValue(values.physicalExam?.specialist);
          const hasDept = hasValidValue(values.physicalExam?.specialistDepartment);
          return hasSpecialist || hasDept ? 1 : 0;
        }
        case 'auxiliary_exam': {
          const ae = values.auxiliaryExams || {};
          return hasValidValue(ae.exams) || hasValidValue(ae.summary) ? 1 : 0;
        }
        default:
          return 0;
      }
    };

    // 各板块权重配置
    const sectionWeights: Record<string, number> = {
      general: 1,
      chief_complaint: 1.2,
      hpi: 1.5,
      past_history: 1,
      personal_history: 0.8,
      marital_history: 0.6,
      family_history: 0.6,
      review_of_systems: 0.8,
      physical_exam: 1,
      specialist: 0.5,
      auxiliary_exam: 0.8,
    };

    // 计算加权完成度
    let totalWeight = 0;
    let weightedProgress = 0;

    const nextSections: SectionStatus[] = SECTIONS.map(s => {
      const sectionProgress = calculateSectionProgress(s.key);
      const weight = sectionWeights[s.key] || 1;
      totalWeight += weight;
      weightedProgress += sectionProgress * weight;

      const completed = sectionProgress >= 0.8;
      const started = isSectionStarted(s.key);
      
      return {
        key: s.key,
        label: s.label,
        isCompleted: completed,
        status: completed ? 'completed' : (started ? 'in_progress' : 'not_started'),
        progress: sectionProgress,
      };
    });

    const nextProgress = totalWeight > 0 ? (weightedProgress / totalWeight) * 100 : 0;
    
    setSections(nextSections);
    setLocalProgress(nextProgress);
    setProgress(nextProgress);
    
    console.log('[Session] 进度计算完成', { 
      progress: Math.round(nextProgress), 
      completedSections: nextSections.filter(s => s.isCompleted).length 
    });
  }, [setProgress]);

  const generateReportMarkdown = useCallback((val: FormValues): string => {
    const keyToNameMap = useAssistantStore.getState().knowledge.keyToName || {};
    const escapeHtml = (input: unknown): string => {
      const s = String(input ?? '').trim();
      return s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    };

    const escapeTableCell = (input: unknown): string => {
      const s = String(input ?? '').trim();
      if (!s) return '未填写';
      return escapeHtml(s).replaceAll('|', '\\|');
    };

    const formatDateTime = (v: unknown, fmt: string, fallback: string): string => {
      if (dayjs.isDayjs(v)) return v.isValid() ? v.format(fmt) : fallback;
      if (typeof v === 'string' || typeof v === 'number' || v instanceof Date) {
        const d = dayjs(v);
        return d.isValid() ? d.format(fmt) : fallback;
      }
      return fallback;
    };

    const nonEmpty = (v: unknown): string => {
      const s = String(v ?? '').trim();
      if (!s || s === '-' || s === '—' || s === '无') return '';
      return s;
    };

    const ensureEnd = (text: unknown): string => {
      const t = String(text ?? '').trim();
      if (!t) return '';
      return /[。！？]$/u.test(t) ? t : `${t}。`;
    };

    const toRecord = (v: unknown): Record<string, unknown> => {
      if (typeof v === 'object' && v !== null) return v as Record<string, unknown>;
      return {};
    };

    const mapStatus = (raw: string): { label: string; cls: string } => {
      const s = String(raw || '').toLowerCase();
      if (s === 'completed') return { label: '已完成', cls: 'status-positive' };
      if (s === 'archived') return { label: '已归档', cls: 'status-neutral' };
      return { label: '草稿', cls: 'status-neutral' };
    };

    const cc = val.chiefComplaint;
    let ccText = '';
    if (cc?.text) ccText = cc.text;
    else if (cc?.symptom) {
      ccText = `${cc.symptom}`;
      if (cc.durationNum && cc.durationUnit) {
        const maxV = (cc as unknown as { durationNumMax?: number }).durationNumMax;
        const range = typeof maxV === 'number' && Number.isFinite(maxV) && maxV >= cc.durationNum
          ? `${cc.durationNum}-${maxV}`
          : `${cc.durationNum}`;
        ccText += ` ${range}${cc.durationUnit}`;
      }
    }
    const ccLine = (() => {
      const t = String(ccText || '').trim();
      if (!t) return '未录入。';
      return /[。！？]$/u.test(t) ? t : `${t}。`;
    })();

    const deriveMainSymptom = (text?: string): string => {
      const raw = String(text || '').trim();
      if (!raw) return '';
      const cleaned = raw
        .replace(/[“”"']/g, '')
        .replace(/[。；;]$/g, '')
        .trim();
      const cutIdx = cleaned.search(/\d/u);
      const head = (cutIdx >= 0 ? cleaned.slice(0, cutIdx) : cleaned)
        .replace(/[，,].*$/u, '')
        .replace(/^(反复发作|反复|持续|间断|阵发|突发|发作性)/u, '')
        .trim();
      return head;
    };
    const mainSymptomForHpi = deriveMainSymptom(cc?.text || ccText) || (cc?.symptom || '').trim() || '不适';
    const hpiNarrativeSource = nonEmpty((val.presentIllness as unknown as { narrativeSource?: unknown } | undefined)?.narrativeSource);
    const manualHpiText =
      hpiNarrativeSource === 'manual'
        ? nonEmpty((val.presentIllness as unknown as { narrative?: unknown } | undefined)?.narrative)
        : undefined;
    const builtHpiNarrative = buildHpiNarrative(val.presentIllness || {}, mainSymptomForHpi, keyToNameMap);
    const hpiText = String(manualHpiText || builtHpiNarrative || '').trimEnd();
    const normalizeHpiLine = (line: string): string => {
      let s = String(line || '').replace(/\r/g, '').trim();
      s = s.replace(/^>\s*/u, '');
      s = s.replace(/^#{1,6}\s+/u, '');
      s = s.replace(/^(\d+)[.)]\s+/u, '$1 ');
      s = s.replace(/^[-*+]\s+/u, '');
      if (/^一般情况[:：]/u.test(s)) s = `起病以来，${s.replace(/^一般情况[:：]\s*/u, '').trim()}`;
      s = s
        .replace(/!\[([^\]]*)\]\([^)]+\)/gu, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
        .replace(/`([^`]+)`/gu, '$1')
        .replace(/\*\*([^*]+)\*\*/gu, '$1')
        .replace(/__([^_]+)__/gu, '$1')
        .replace(/\*([^*]+)\*/gu, '$1')
        .replace(/_([^_]+)_/gu, '$1')
        .trim();
      return s;
    };
    const escapeMarkdownText = (input: string): string => {
      return String(input || '')
        .replace(/\\/gu, '\\\\')
        .replace(/\*/gu, '\\*')
        .replace(/_/gu, '\\_')
        .replace(/`/gu, '\\`')
        .replace(/\[/gu, '\\[')
        .replace(/\]/gu, '\\]')
        .replace(/\(/gu, '\\(')
        .replace(/\)/gu, '\\)');
    };
    const formatHpiNarrativeMarkdown = (raw: string): string => {
      const INDENT = '\u3000\u3000';
      const prepared = String(raw || '')
        .replace(/\r\n/g, '\n')
        .replace(/([。；;！？])\s*一般情况[:：]/gu, '$1\n起病以来，')
        .replace(/([。；;！？])\s*起病以来[，、]?/gu, '$1\n起病以来，');
      const lines = prepared
        .split('\n')
        .map(normalizeHpiLine)
        .filter(Boolean);
      if (lines.length === 0) return '';
      const merged = [
        escapeMarkdownText(escapeHtml(lines[0])),
        ...lines.slice(1).map(l => escapeMarkdownText(escapeHtml(`${INDENT}${l.replace(/^\u3000+/u, '')}`))),
      ].join('  \n');
      return merged;
    };

    const admissionTime = val.generalInfo?.admissionTime;
    const recordTime = val.generalInfo?.recordTime;
    const recordTimeText = recordTime
      ? formatDateTime(recordTime, 'YYYY-MM-DD HH:mm', dayjs().format('YYYY-MM-DD HH:mm'))
      : dayjs().format('YYYY-MM-DD HH:mm');
    const admissionTimeText = admissionTime ? formatDateTime(admissionTime, 'YYYY-MM-DD HH:mm', '未记录') : '未记录';

    const status = mapStatus(sessionStatus);

    const pi = val.presentIllness || {};
    const onsetModeText = pi.onsetMode === 'sudden' ? '急骤' : pi.onsetMode === 'gradual' ? '缓慢' : '未记录';
    const onsetTimeText = nonEmpty(pi.onsetTime) || '未记录';
    const triggerText = nonEmpty(pi.trigger) || '无明显诱因';
    const locationText = nonEmpty(pi.location) || '未记录';
    const qualityText = Array.isArray(pi.quality) && pi.quality.length > 0 ? pi.quality.join('、') : '未记录';
    const severityText = nonEmpty(pi.severity) || '未记录';
    const durationText = nonEmpty(pi.durationDetails) || '未记录';
    const factorsText = nonEmpty(pi.factors) || '未记录';
    const admissionDiagnosisText = nonEmpty(pi.admissionDiagnosis) || '未记录';

    const parseTreatments = (text: string) => {
      if (!text) return [];
      const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const byNewline = normalized.split('\n').map(line => line.trim()).filter(Boolean);
      const records = (() => {
        if (byNewline.length > 1) return byNewline;
        const single = byNewline[0] || '';
        const sep = single.includes(',') ? ',' : single.includes('，') ? '，' : '';
        if (!sep) return byNewline;
        return single.split(sep).map(s => String(s || '').trim()).filter(Boolean);
      })();
      return records.map((line, idx) => {
        const match = line.match(/^\[(.*?)\]/u);
        const date = match ? String(match[1] || '').trim() : '';
        const content = match ? line.substring(match[0].length).trim() : line;
        return { date: date || `记录${idx + 1}`, content };
      });
    };
    const treatmentHistoryText = String(pi.treatmentHistory || '').trim();
    const treatments = parseTreatments(treatmentHistoryText);
    const timelineMarkdown = (() => {
      const items: { date: string; content: string }[] = [];
      items.push({
        date: onsetTimeText,
        content: [triggerText ? `诱因：${triggerText}` : undefined, onsetModeText !== '未记录' ? `起病形式：${onsetModeText}` : undefined]
          .filter(Boolean)
          .join('；') || '未记录',
      });
      items.push(...treatments.map(t => ({ date: t.date, content: t.content })));
      items.push({ date: '今日', content: '就诊于我院' });
      return items.map(it => `- **${escapeHtml(it.date || '未记录')}**：${escapeHtml(it.content || '未记录').replaceAll('\n', '；')}`).join('\n');
    })();

    const associated = Array.isArray(pi.associatedSymptoms) ? pi.associatedSymptoms : [];
    const associatedDisplay = associated.map(k => keyToNameMap[k] || k).filter(Boolean);
    const assocText = nonEmpty(pi.associatedSymptomsDetails) || (associatedDisplay.length > 0 ? `伴有${associatedDisplay.join('、')}` : '');
    const negativeText = nonEmpty(pi.negativeSymptoms);

    const past = val.pastHistory || {};
    const pastRec = past as unknown as Record<string, unknown>;
    const diseases: string[] = (past.pmh_diseases || []) as string[];
    const diseaseDetails = (past.diseaseDetails || {}) as Record<string, { year?: number; control?: string; medication?: string }>;

    const chronicTable = (() => {
      if (!Array.isArray(diseases) || diseases.length === 0) return '';
      const rows = diseases.map(d => {
        const dd = diseaseDetails?.[d] || {};
        const year = dd.year ? `${dd.year}年` : '未记录';
        const control = nonEmpty(dd.control) || '未记录';
        const medication = nonEmpty(dd.medication) || '未记录';
        return `| ${escapeTableCell(d)} | ${escapeTableCell(year)} | ${escapeTableCell(control)} | ${escapeTableCell(medication)} |`;
      });
      return [
        '## 慢性病史',
        '',
        '| 疾病 | 确诊时间 | 控制情况 | 用药 |',
        '|---|---|---|---|',
        ...rows,
        '',
      ].join('\n');
    })();

    const surgeries = pastRec.surgeries;
    const surgeryLines: string[] = [];
    if (Array.isArray(surgeries) && surgeries.length > 0) {
      surgeries.forEach((s: unknown) => {
        const r = toRecord(s);
        const dateText = formatDateTime(r.date, 'YYYY-MM', '时间不详');
        const location = nonEmpty(r.location ?? r.hospital) || '外院';
        const name = nonEmpty(r.name) || '不详';
        const outcome = nonEmpty(r.outcome ?? r.note);
        const line = `${dateText}于${location}行“${name}”${outcome ? `，${outcome}` : ''}`;
        surgeryLines.push(ensureEnd(line).replace(/。$/u, ''));
      });
    }

    const transfusions = pastRec.transfusions;
    const transfusionLines: string[] = [];
    if (Array.isArray(transfusions) && transfusions.length > 0) {
      transfusions.forEach((t: unknown) => {
        const r = toRecord(t);
        const dateText = formatDateTime(r.date, 'YYYY-MM-DD', '时间不详');
        const amount = nonEmpty(r.amount);
        const reaction = nonEmpty(r.reaction) || '无不良反应';
        transfusionLines.push(`${dateText}：${amount ? `输${amount}` : '输血'}，${reaction}`);
      });
    }

    const allergies = pastRec.allergies;
    const allergyText = (() => {
      if (Array.isArray(allergies) && allergies.length > 0) {
        const severityMap: Record<string, string> = { mild: '轻度', moderate: '中度', severe: '重度' };
        return allergies
          .map((a: unknown) => {
            const r = toRecord(a);
            const allergen = nonEmpty(r.allergen ?? r.substance) || '过敏原不详';
            const reaction = nonEmpty(r.reaction);
            const severityRaw = nonEmpty(r.severity);
            const severity = severityMap[severityRaw] || severityRaw;
            const extra = [reaction, severity].filter(Boolean).join('，');
            return extra ? `${allergen}（${extra}）` : allergen;
          })
          .join('、');
      }
      return '';
    })();

    const infectiousText = nonEmpty(pastRec.infectiousHistory ?? pastRec.pmh_infectious ?? past.pmh_infectious) || '';
    const vaccinationText = nonEmpty(past.vaccinationHistory) || '';

    const personal = val.personalHistory || {};
    const marital = val.maritalHistory || {};
    const fertility = val.fertilityHistory || {};
    const familySummary = nonEmpty(val.familyHistory?.summary) || '未提及特殊家族病史';

    const ros = val.reviewOfSystems;
    const rosLines = (() => {
      if (!ros || Object.keys(ros).length === 0) return ['- 未录入'];
      const systemsOrder = [
        { key: 'respiratory', label: '呼吸系统' },
        { key: 'cardiovascular', label: '循环系统' },
        { key: 'digestive', label: '消化系统' },
        { key: 'urinary', label: '泌尿系统' },
        { key: 'neurological', label: '神经系统' },
      ];
      return systemsOrder.map(sys => {
        const data = ros[sys.key];
        if (!data) return `- ${sys.label}：未询问`;
        const positives =
          data.symptoms && data.symptoms.length > 0
            ? `有${data.symptoms.map(k => keyToNameMap[k] || k).join('、')}`
            : '无特殊症状';
        const details = data.details ? `，${data.details}` : '';
        return `- ${sys.label}：${ensureEnd(`${positives}${details}`)}`;
      });
    })();

    const pe = val.physicalExam;
    const vital = pe?.vitalSigns;
    const vitalTable = [
      '| 项目 | 数值 |',
      '|---|---|',
      `| T | ${escapeTableCell(vital?.temperature != null ? `${vital.temperature}` : '未记录')} ℃ |`,
      `| P | ${escapeTableCell(vital?.pulse != null ? `${vital.pulse}` : '未记录')} 次/分 |`,
      `| R | ${escapeTableCell(vital?.respiration != null ? `${vital.respiration}` : '未记录')} 次/分 |`,
      `| BP | ${escapeTableCell(vital?.systolicBP != null && vital?.diastolicBP != null ? `${vital.systolicBP}/${vital.diastolicBP}` : '未记录')} mmHg |`,
    ].join('\n');

    const ae = val.auxiliaryExams;
    const auxLines = (() => {
      if (nonEmpty(ae?.summary)) return [`- ${escapeHtml(ae?.summary).replaceAll('\n', '；')}`];
      if (ae?.exams && ae.exams.length > 0) {
        return ae.exams.map(ex => {
          const dateText = ex.date ? formatDateTime(ex.date, 'YYYY-MM-DD', '') : '';
          const title = [dateText, ex.name].filter(Boolean).join(' ');
          return `- ${escapeHtml(title)}：${escapeHtml(ex.result)}`;
        });
      }
      return ['- 暂未录入辅助检查结果'];
    })();

    const smokingLine = (() => {
      if (personal.smokingHistory) return ensureEnd(personal.smokingHistory);
      if (personal.smoking_status === 'never') return '从不吸烟';
      if (personal.smokingYears || personal.cigarettesPerDay) return `吸烟${personal.smokingYears || 0}年，平均${personal.cigarettesPerDay || 0}支/日`;
      return '未记录';
    })();
    const alcoholLine = (() => {
      if (personal.drinkingHistory) return ensureEnd(personal.drinkingHistory);
      if (personal.alcohol_status === 'never') return '从不饮酒';
      if (personal.drinkFreqPerWeek) return `饮酒${personal.drinkFreqPerWeek || 0}次/周`;
      return '未记录';
    })();

    const maritalStatus = nonEmpty(marital.status) || '未记录';
    const spouseHealth = nonEmpty(marital.spouse_health) || '未记录';
    const chronicSummary = Array.isArray(diseases) && diseases.length > 0 ? diseases.join('、') : '';
    const pendingItems = (() => {
      const items: string[] = [];
      if (!vital || (vital.temperature == null && vital.pulse == null && vital.respiration == null && vital.systolicBP == null && vital.diastolicBP == null)) {
        items.push('生命体征');
      }
      if (!ae || (!nonEmpty(ae.summary) && (!ae.exams || ae.exams.length === 0))) {
        items.push('辅助检查');
      }
      if (!pe) items.push('体格检查');
      return items;
    })();

    const md = [
      '# 医疗记录',
      '',
      `**记录时间**：${escapeHtml(recordTimeText)}  **记录人**：—  **状态**：${escapeHtml(status.label)}`,
      '',
      '---',
      '',
      '# 📋 基本信息',
      '',
      '| 项目 | 内容 | 项目 | 内容 |',
      '|---|---|---|---|',
      `| 姓名 | ${escapeTableCell(val.name)} | 性别 | ${escapeTableCell(val.gender)} |`,
      `| 年龄 | ${escapeTableCell(val.age != null ? `${val.age}` : '')} | 民族 | ${escapeTableCell(val.ethnicity)} |`,
      `| 婚姻状况 | ${escapeTableCell(val.maritalHistory?.status)} | 出生地 | ${escapeTableCell(val.placeOfBirth)} |`,
      `| 职业 | ${escapeTableCell(val.occupation)} | 联系电话 | ${escapeTableCell(val.phone)} |`,
      `| 住址 | ${escapeTableCell(val.address)} | 病史陈述者 | ${escapeTableCell(val.historian ? `${val.historian}${val.reliability ? `（${val.reliability}）` : ''}` : '')} |`,
      '',
      '## 入院信息',
      '',
      '| 项目 | 内容 |',
      '|---|---|',
      `| 入院时间 | ${escapeTableCell(admissionTimeText)} |`,
      `| 记录时间 | ${escapeTableCell(recordTimeText)} |`,
      '',
      '---',
      '',
      '# 🎯 主诉',
      '',
      `${escapeHtml(ccLine)}`,
      '',
      '---',
      '',
      '# 📖 现病史',
      '',
      ...(hpiText
        ? [
            formatHpiNarrativeMarkdown(hpiText),
            '',
          ]
        : [
            ...(() => {
              const first = `患者${onsetTimeText !== '未记录' ? `于${onsetTimeText}` : ''}${triggerText !== '无明显诱因' ? `因${triggerText}` : '无明显诱因'}出现${mainSymptomForHpi}，${locationText !== '未记录' ? `部位位于${locationText}，` : ''}${qualityText !== '未记录' ? `性质为${qualityText}，` : ''}${severityText !== '未记录' ? `程度${severityText}，` : ''}${durationText !== '未记录' ? `持续时间${durationText}` : ''}。${factorsText !== '未记录' ? `${factorsText}` : ''}`.replace(/[。；，、]+$/u, '。');
              const excretionText = (() => {
                if (!pi.urine_stool) return '';
                const cleaned = String(pi.urine_stool)
                  .trim()
                  .replace(/^大小便[:：]?\s*/u, '')
                  .trim();
                if (!cleaned) return '';
                if (/^(小便|大便|二便)/u.test(cleaned)) return cleaned;
                return `二便${cleaned}`;
              })();
              const weightText = (() => {
                if (!pi.weight) return '';
                const raw = String(pi.weight).trim();
                const mapped = raw === 'no_change' ? '无明显变化'
                  : raw === 'loss' ? '下降'
                  : raw === 'gain' ? '增加'
                  : raw === '无变化' ? '无明显变化'
                  : raw;
                const jinRaw = (pi as unknown as Record<string, unknown>).weight_change_jin;
                const n = typeof jinRaw === 'number' ? jinRaw : Number(String(jinRaw ?? '').trim());
                const hasJin = Number.isFinite(n) && n > 0;
                if ((mapped === '下降' || mapped === '增加') && hasJin && !/斤/u.test(mapped)) return `${mapped}${n}斤`;
                return mapped;
              })();
              const general = [
                pi.spirit ? `精神${pi.spirit}` : '',
                pi.strength ? `体力${pi.strength}` : '',
                pi.appetite ? `食欲${pi.appetite}` : '',
                pi.sleep ? `睡眠${pi.sleep}` : '',
                weightText ? `体重${weightText}` : '',
                excretionText,
              ]
                .filter(Boolean)
                .join('，');
              if (!general) return [first];
              const second = `起病以来，${general.replace(/。$/u, '')}。`;
              return [`${first}  \n\u3000\u3000${second}`];
            })(),
            '',
            '## 诊疗经过',
            '',
            timelineMarkdown,
            '',
            '## 伴随症状',
            '',
            ...(assocText ? [`- 阳性：${escapeHtml(assocText)}`] : ['- 未记录']),
            ...(negativeText ? [`- 阴性：${escapeHtml(negativeText)}`] : []),
            '',
          ]),
      '---',
      '',
      '# 🏥 既往史',
      '',
      ...(chronicTable ? [chronicTable] : []),
      '## 手术外伤史',
      '',
      ...(surgeryLines.length > 0 ? surgeryLines.map(s => `- ${escapeMarkdownText(escapeHtml(s))}`) : ['- 未记录']),
      '',
      '## 过敏史',
      '',
      ...(allergyText
        ? [`> 过敏史：${escapeHtml(allergyText)}`]
        : ['- 否认药物及食物过敏史']),
      '',
      '## 输血史',
      '',
      ...(transfusionLines.length > 0 ? transfusionLines.map(s => `- ${escapeHtml(s)}`) : ['- 否认输血史']),
      '',
      '## 传染病史',
      '',
      ...(infectiousText ? [`- ${escapeHtml(ensureEnd(infectiousText))}`] : ['- 否认肝炎、结核、梅毒、艾滋病等传染病史']),
      '',
      ...(vaccinationText ? ['## 预防接种史', '', `- ${escapeHtml(ensureEnd(vaccinationText))}`, ''] : []),
      '---',
      '',
      '# 👤 个人史',
      '',
      '| 项目 | 内容 |',
      '|---|---|',
      `| 出生地 | ${escapeTableCell(val.placeOfBirth)} |`,
      `| 居留地 | ${escapeTableCell(personal.living_habits)} |`,
      `| 吸烟史 | ${escapeTableCell(smokingLine)} |`,
      `| 饮酒史 | ${escapeTableCell(alcoholLine)} |`,
      `| 冶游史 | ${escapeTableCell('否认')} |`,
      '',
      '---',
      '',
      '# 💑 婚育史',
      '',
      '| 项目 | 内容 |',
      '|---|---|',
      `| 婚姻状况 | ${escapeTableCell(maritalStatus)} |`,
      `| 配偶健康 | ${escapeTableCell(spouseHealth)} |`,
      '',
      ...(val.gender === '女' && val.menstrualHistory
        ? [
            '## 月经史',
            '',
            `- ${escapeHtml(
              `初潮${val.menstrualHistory.age || '?'}岁，周期${val.menstrualHistory.cycle || '?'}天，经期${val.menstrualHistory.duration || '?'}天。末次月经：${
                val.menstrualHistory.lmp_date ? formatDateTime(val.menstrualHistory.lmp_date, 'YYYY-MM-DD', '不详') : '不详'
              }。`
            )}`,
            '',
          ]
        : []),
      ...(val.gender === '女' && (fertility.term || fertility.preterm || fertility.abortion || fertility.living)
        ? [
            '## 生育史',
            '',
            `- ${escapeHtml(`足月产${fertility.term || 0}次，早产${fertility.preterm || 0}次，流产${fertility.abortion || 0}次，现存子女${fertility.living || 0}人。`)}`,
            '',
          ]
        : []),
      '---',
      '',
      '# 👨‍👩‍👧‍👦 家族史',
      '',
      `- ${escapeHtml(ensureEnd(familySummary) || familySummary)}`,
      '',
      '---',
      '',
      '# 🔍 系统回顾',
      '',
      ...rosLines,
      '',
      '---',
      '',
      '# 🩺 体格检查',
      '',
      '## 生命体征',
      '',
      vitalTable,
      '',
      ...(pe
        ? [
            '## 检查记录',
            '',
            ...[
              pe.general?.description ? `- 一般情况：${escapeHtml(pe.general.description)}` : '',
              pe.skinMucosa ? `- 皮肤粘膜：${escapeHtml(pe.skinMucosa)}` : '',
              pe.lymphNodes ? `- 淋巴结：${escapeHtml(pe.lymphNodes)}` : '',
              pe.head ? `- 头部：${escapeHtml(pe.head)}` : '',
              pe.neck ? `- 颈部：${escapeHtml(pe.neck)}` : '',
              pe.chest?.lungs ? `- 肺部：${escapeHtml(pe.chest.lungs)}` : '',
              pe.chest?.heart ? `- 心脏：${escapeHtml(pe.chest.heart)}` : '',
              pe.abdomen ? `- 腹部：${escapeHtml(pe.abdomen)}` : '',
              pe.spineLimbs ? `- 脊柱四肢：${escapeHtml(pe.spineLimbs)}` : '',
              pe.neurological ? `- 神经系统：${escapeHtml(pe.neurological)}` : '',
              pe.specialist ? `- 专科情况：${escapeHtml(pe.specialist)}` : '',
            ].filter(Boolean),
            '',
          ]
        : ['- 检查记录：未完成', '']),
      '---',
      '',
      '# 🔬 辅助检查',
      '',
      ...auxLines,
      '',
      '---',
      '',
      '# 📝 初步印象',
      '',
      `- 诊断考虑：${escapeHtml(admissionDiagnosisText)}`,
      '',
      '---',
      '',
      '# ⚠️ 重要提醒',
      '',
      `- 过敏史：${escapeHtml(allergyText || '未记录')}`,
      `- 慢性病史：${escapeHtml(chronicSummary || '未记录')}`,
      `- 待完善：${escapeHtml(pendingItems.length > 0 ? pendingItems.join('、') : '无')}`,
      '',
      '---',
      '',
      '# 📌 记录状态',
      '',
      '| 项目 | 内容 |',
      '|---|---|',
      `| 状态 | ${escapeTableCell(status.label)} |`,
      `| 最后记录时间 | ${escapeTableCell(recordTimeText)} |`,
    ]
      .filter(Boolean)
      .join('\n');

    return md;
  }, [sessionStatus]);

  const generateReportPlainText = useCallback((val: FormValues): string => {
    const keyToNameMap = useAssistantStore.getState().knowledge.keyToName || {};
    const nonEmpty = (v: unknown): string => {
      const s = String(v ?? '').trim();
      if (!s || s === '-' || s === '—' || s === '无') return '';
      return s;
    };

    const ensureEnd = (text: unknown): string => {
      const t = String(text ?? '').trim();
      if (!t) return '';
      return /[。！？]$/u.test(t) ? t : `${t}。`;
    };

    const formatDateTime = (v: unknown, fmt: string, fallback: string): string => {
      if (dayjs.isDayjs(v)) return v.isValid() ? v.format(fmt) : fallback;
      if (typeof v === 'string' || typeof v === 'number' || v instanceof Date) {
        const d = dayjs(v);
        return d.isValid() ? d.format(fmt) : fallback;
      }
      return fallback;
    };

    const deriveMainSymptom = (text?: string): string => {
      const raw = String(text || '').trim();
      if (!raw) return '';
      const cleaned = raw
        .replace(/[“”"']/g, '')
        .replace(/[。；;]$/g, '')
        .trim();
      const cutIdx = cleaned.search(/\d/u);
      const head = (cutIdx >= 0 ? cleaned.slice(0, cutIdx) : cleaned)
        .replace(/[，,].*$/u, '')
        .replace(/^(反复发作|反复|持续|间断|阵发|突发|发作性)/u, '')
        .trim();
      return head;
    };

    const mapStatus = (raw: string): string => {
      const s = String(raw || '').toLowerCase();
      if (s === 'completed') return '已完成';
      if (s === 'archived') return '已归档';
      return '草稿';
    };

    const lines: string[] = [];
    const recordTime = val.generalInfo?.recordTime;
    const recordTimeText = recordTime
      ? formatDateTime(recordTime, 'YYYY-MM-DD HH:mm', dayjs().format('YYYY-MM-DD HH:mm'))
      : dayjs().format('YYYY-MM-DD HH:mm');
    lines.push('医疗记录');
    lines.push(`记录时间：${recordTimeText}  状态：${mapStatus(sessionStatus)}`);
    lines.push('');

    lines.push('基本信息');
    lines.push(`姓名：${val.name || '未填写'}  性别：${val.gender || '未填写'}  年龄：${val.age != null ? `${val.age}岁` : '未填写'}`);
    lines.push(`民族：${val.ethnicity || '未填写'}  婚姻状况：${val.maritalHistory?.status || '未填写'}  出生地：${val.placeOfBirth || '未填写'}`);
    lines.push(`职业：${val.occupation || '未填写'}  联系电话：${val.phone || '未填写'}  住址：${val.address || '未填写'}`);
    const admissionTime = val.generalInfo?.admissionTime;
    lines.push(`入院时间：${admissionTime ? formatDateTime(admissionTime, 'YYYY-MM-DD HH:mm', '未记录') : '未记录'}  记录时间：${recordTimeText}`);
    lines.push(`病史陈述者：${val.historian || '未填写'}${val.reliability ? `（${val.reliability}）` : ''}`);
    lines.push('');

    const cc = val.chiefComplaint;
    let ccText = '';
    if (cc?.text) ccText = cc.text;
    else if (cc?.symptom) {
      ccText = `${cc.symptom}`;
      if (cc.durationNum && cc.durationUnit) {
        const maxV = (cc as unknown as { durationNumMax?: number }).durationNumMax;
        const range = typeof maxV === 'number' && Number.isFinite(maxV) && maxV >= cc.durationNum
          ? `${cc.durationNum}-${maxV}`
          : `${cc.durationNum}`;
        ccText += ` ${range}${cc.durationUnit}`;
      }
    }
    const ccLine = (() => {
      const t = String(ccText || '').trim();
      if (!t) return '未录入。';
      return /[。！？]$/u.test(t) ? t : `${t}。`;
    })();
    lines.push('主诉');
    lines.push(ccLine);
    lines.push('');

    lines.push('现病史');
    const pi = val.presentIllness || {};
    const onsetModeText = pi.onsetMode === 'sudden' ? '急骤' : pi.onsetMode === 'gradual' ? '缓慢' : '未记录';
    const onsetTimeText = nonEmpty(pi.onsetTime) || '未记录';
    const triggerText = nonEmpty(pi.trigger) || '无明显诱因';
    const locationText = nonEmpty(pi.location) || '未记录';
    const qualityText = Array.isArray(pi.quality) && pi.quality.length > 0 ? pi.quality.join('、') : '未记录';
    const severityText = nonEmpty(pi.severity) || '未记录';
    const durationText = nonEmpty(pi.durationDetails) || '未记录';
    const factorsText = nonEmpty(pi.factors) || '未记录';
    lines.push(`起病时间：${onsetTimeText}  起病形式：${onsetModeText}  诱因：${triggerText}`);
    lines.push(`部位：${locationText}  性质：${qualityText}  程度：${severityText}  持续时间/频率：${durationText}  缓解/加重因素：${factorsText}`);

    const associated = Array.isArray(pi.associatedSymptoms) ? pi.associatedSymptoms : [];
    const associatedDisplay = associated.map(k => keyToNameMap[k] || k).filter(Boolean);
    const assocText = nonEmpty(pi.associatedSymptomsDetails) || (associatedDisplay.length > 0 ? `伴有${associatedDisplay.join('、')}` : '');
    const negativeText = nonEmpty(pi.negativeSymptoms);
    if (assocText) lines.push(`伴随症状（阳性）：${ensureEnd(assocText)}`);
    if (negativeText) lines.push(`伴随症状（阴性）：${ensureEnd(negativeText)}`);

    const hpiMainSymptom = deriveMainSymptom(cc?.text || ccText) || (cc?.symptom || '').trim() || '不适';
    const hpiNarrativeSource = nonEmpty((val.presentIllness as unknown as { narrativeSource?: unknown } | undefined)?.narrativeSource);
    const manualHpiText =
      hpiNarrativeSource === 'manual'
        ? nonEmpty((val.presentIllness as unknown as { narrative?: unknown } | undefined)?.narrative)
        : undefined;
    const builtHpiNarrative = buildHpiNarrative(val.presentIllness || {}, hpiMainSymptom, keyToNameMap);
    const hpiText = String(manualHpiText || builtHpiNarrative || '').trimEnd();
    if (hpiText) {
      lines.push('');
      lines.push('现病史叙述');
      lines.push(hpiText);
    }
    lines.push('');

    lines.push('既往史');
    const past = val.pastHistory || {};
    const diseases: string[] = (past.pmh_diseases || []) as string[];
    if (Array.isArray(diseases) && diseases.length > 0) lines.push(`慢性病史：${ensureEnd(`既往患有${diseases.join('、')}`)}`);
    const allergyItems = Array.isArray(past.allergies) ? past.allergies : [];
    if (allergyItems.length > 0) {
      const severityMap: Record<string, string> = { mild: '轻度', moderate: '中度', severe: '重度' };
      const allergyText = allergyItems
        .map(a => {
          const allergen = nonEmpty(a.substance) || '过敏原不详';
          const reaction = nonEmpty(a.reaction);
          const severityRaw = nonEmpty(a.severity);
          const severity = severityMap[severityRaw] || severityRaw;
          const extra = [reaction, severity].filter(Boolean).join('，');
          return extra ? `${allergen}（${extra}）` : allergen;
        })
        .join('、');
      lines.push(`过敏史：${ensureEnd(allergyText)}`);
    } else {
      lines.push('过敏史：否认药物及食物过敏史。');
    }
    lines.push('');

    lines.push('体格检查');
    const pe = val.physicalExam;
    const vital = pe?.vitalSigns;
    if (vital) {
      lines.push(
        `T：${vital.temperature != null ? `${vital.temperature}℃` : '未记录'}  P：${vital.pulse != null ? `${vital.pulse}次/分` : '未记录'}  R：${vital.respiration != null ? `${vital.respiration}次/分` : '未记录'}  BP：${
          vital.systolicBP != null && vital.diastolicBP != null ? `${vital.systolicBP}/${vital.diastolicBP}mmHg` : '未记录'
        }`
      );
    } else {
      lines.push('生命体征：未记录。');
    }
    lines.push('');

    lines.push('辅助检查');
    const ae = val.auxiliaryExams;
    if (nonEmpty(ae?.summary)) lines.push(String(ae?.summary || '').trim());
    else if (ae?.exams && ae.exams.length > 0) {
      ae.exams.forEach(ex => {
        const dateText = ex.date ? formatDateTime(ex.date, 'YYYY-MM-DD', '') : '';
        lines.push(`${[dateText, ex.name].filter(Boolean).join(' ')}：${ex.result}`);
      });
    } else {
      lines.push('暂缺。');
    }
    lines.push('');

    lines.push('初步印象');
    lines.push(`诊断考虑：${nonEmpty(val.presentIllness?.admissionDiagnosis) || '未记录'}`);

    return lines.join('\n');
  }, [sessionStatus]);

  // Load Session Data
  useEffect(() => {
    if (!id || id === 'new') return;
    
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/sessions/${id}`) as ApiResponse<SessionRes>;
        const data = unwrapData<SessionRes>(res);
        if (data) {
          const normalizeMaybeGarbledString = (v: unknown): string | undefined => {
            const s = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
            if (!s) return undefined;
            if (s.includes('\uFFFD')) return undefined;
            const hasCjk = /[\u4E00-\u9FFF]/u.test(s);
            const hasManyQuestion = /[?？]/u.test(s) && /^[?？0-9\s]+$/u.test(s);
            if (!hasCjk && hasManyQuestion) return undefined;
            if (!hasCjk && /^[?？]+$/u.test(s)) return undefined;
            return s;
          };
          setIsValidId(true);
          if (typeof data.status === 'string' && data.status) setSessionStatus(data.status);
          
          // Merge patient info into top level fields
          const patient = data.patient || {};
          const contact = patient.contactInfo || {};
          const generalInfo = data.generalInfo as { admissionTime?: string; recordTime?: string } | undefined;
          const pastHistory = data.pastHistory;
          const menstrualHistory = data.menstrualHistory;
          const auxiliaryExams = data.auxiliaryExams;
          const chiefComplaint = (() => {
            const cc = data.chiefComplaint;
            if (!cc || typeof cc !== 'object') return cc as FormValues['chiefComplaint'];
            const rec = cc as Record<string, unknown>;
            const next: Record<string, unknown> = { ...rec };
            next.text = normalizeMaybeGarbledString(rec.text);
            next.symptom = normalizeMaybeGarbledString(rec.symptom);
            next.durationUnit = normalizeMaybeGarbledString(rec.durationUnit);
            return next as FormValues['chiefComplaint'];
          })();
          
          // Flatten data for form
          const formData: FormValues = {
             // General Info (Patient)
             name: patient.name,
             gender: normalizeMaybeGarbledString(patient.gender),
             birthDate: patient.birthDate ? dayjs(patient.birthDate) : undefined,
             ethnicity: patient.ethnicity,
             nativePlace: patient.nativePlace,
             placeOfBirth: patient.placeOfBirth,
             address: patient.address,
             occupation: patient.occupation,
             employer: patient.employer,
             phone: contact.phone,
             
             // Session specific general info
             historian: data.historian,
             reliability: normalizeMaybeGarbledString(data.reliability),
             historianRelationship: data.historianRelationship,
             generalInfo: {
                admissionTime: generalInfo?.admissionTime ? dayjs(generalInfo.admissionTime) : undefined,
                recordTime: generalInfo?.recordTime ? dayjs(generalInfo.recordTime) : undefined,
             },

             // Modules
             chiefComplaint,
             presentIllness: data.presentIllness,
             pastHistory: pastHistory
               ? {
                   ...pastHistory,
                   surgeries: pastHistory.surgeries?.map(s => ({
                     ...s,
                     date: s?.date
                       ? (dayjs.isDayjs(s.date) ? s.date : dayjs(s.date))
                       : undefined,
                   })),
                   transfusions: pastHistory.transfusions?.map(t => ({
                     ...t,
                     date: t?.date
                       ? (dayjs.isDayjs(t.date) ? t.date : dayjs(t.date))
                       : undefined,
                   })),
                 }
               : undefined,
             personalHistory: data.personalHistory,
             maritalHistory: data.maritalHistory,
             menstrualHistory: menstrualHistory
               ? {
                   ...menstrualHistory,
                   lmp_date: menstrualHistory.lmp_date
                     ? (dayjs.isDayjs(menstrualHistory.lmp_date)
                         ? menstrualHistory.lmp_date
                         : dayjs(menstrualHistory.lmp_date))
                     : undefined,
                 }
               : undefined,
             fertilityHistory: data.fertilityHistory,
             familyHistory: data.familyHistory,
             reviewOfSystems: data.reviewOfSystems,
             physicalExam: data.physicalExam,
             auxiliaryExams: auxiliaryExams
               ? {
                   ...auxiliaryExams,
                   exams: auxiliaryExams.exams?.map(ex => ({
                     ...ex,
                     date: ex?.date
                       ? (dayjs.isDayjs(ex.date) ? ex.date : dayjs(ex.date))
                       : undefined,
                   })),
                 }
               : undefined,
          };

          form.setFieldsValue(formData);
          console.log('[Session] 数据加载完成', formData);
          // 使用 formData 直接计算完成度，避免 setFieldsValue 异步导致的获取不到最新值
          computeCompletion(formData as FormValues);
          setLastSavedAt(Date.now());
        } else {
          setIsValidId(false);
          message.error('未找到该会话记录');
        }
      } catch (err) {
        console.error(err);
        setIsValidId(false);
        message.error('加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, form, computeCompletion]);

  const normalizePayload = useCallback((input: unknown): unknown => {
    const seen = new WeakSet<object>();
    const walk = (v: unknown): unknown => {
      if (v === null || v === undefined) return v;
      if (dayjs.isDayjs(v)) return v.toISOString();
      if (Array.isArray(v)) return v.map(walk);
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        if (seen.has(obj)) return undefined;
        seen.add(obj);
        const out: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(obj)) {
          const next = walk(val);
          if (next !== undefined) out[k] = next;
        }
        return out;
      }
      return v;
    };
    return walk(input);
  }, []);

  const handleSave = useCallback(async (isAutoSave = false, silent = false) => {
    try {
      const values = form.getFieldsValue(true) as FormValues;
      if (!isAutoSave) setLoading(true);

      // Separate patient and session data
      const payload = {
         // Patient fields
         name: values.name,
         gender: values.gender,
         birthDate: values.birthDate,
         ethnicity: values.ethnicity,
         nativePlace: values.nativePlace,
         placeOfBirth: values.placeOfBirth,
         address: values.address,
         occupation: values.occupation,
         employer: values.employer,
         phone: typeof values.phone === 'string' ? values.phone.trim() || undefined : values.phone,
         
         // Session fields
         historian: values.historian,
         reliability: values.reliability,
         historianRelationship: values.historianRelationship,
         generalInfo: values.generalInfo,
         
         chiefComplaint: values.chiefComplaint,
         presentIllness: values.presentIllness,
         pastHistory: values.pastHistory,
         personalHistory: values.personalHistory,
         maritalHistory: values.maritalHistory,
         menstrualHistory: values.menstrualHistory,
         fertilityHistory: values.fertilityHistory,
         familyHistory: values.familyHistory,
         reviewOfSystems: values.reviewOfSystems,
         physicalExam: values.physicalExam,
         auxiliaryExams: values.auxiliaryExams,
      };

      const normalized = normalizePayload(payload);
      const n =
        normalized && typeof normalized === 'object'
          ? (normalized as Record<string, unknown>)
          : null;
      console.log('[Session] 保存请求摘要', {
        id,
        gender: n?.['gender'],
        reliability: n?.['reliability'],
        chiefComplaint: n?.['chiefComplaint'],
        hasGeneralInfo: Boolean(n?.['generalInfo']),
      });
      await api.patch(`/sessions/${id}`, normalized);
      
      if (!silent) message.success('保存成功');
      console.log('[Session] 保存成功', isAutoSave ? '(Auto)' : '(Manual)');
      setLastSavedAt(Date.now());
    } catch (err) {
      const e = err as unknown;
      const asRecord = (v: unknown): Record<string, unknown> | null =>
        v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
      const rec = asRecord(e);
      const response = rec ? asRecord(rec.response) : null;
      console.error('[Session] 保存失败', {
        message: rec?.message,
        status: response?.status,
        data: response?.data,
      });
      if (!silent) message.error('保存失败');
    } finally {
      if (!isAutoSave) setLoading(false);
    }
  }, [id, form, normalizePayload]);

  // Auto-save logic
  useEffect(() => {
     const timer = setInterval(() => {
         if (isValidId) {
             handleSave(true, true);
         }
     }, 30000); // 30s auto save
     return () => clearInterval(timer);
  }, [isValidId, handleSave]);

  const handlePreview = () => {
    const val = form.getFieldsValue(true);
    const md = generateReportMarkdown(val);
    setPreviewContent(md);
    setPreviewPlainText(generateReportPlainText(val));
    setShowPreview(true);
  };

  const currentSectionIndex = React.useMemo(
    () => SECTIONS.findIndex(s => s.key === currentSection),
    [currentSection]
  );
  const canGoPrev = currentSectionIndex > 0;
  const canGoNext = currentSectionIndex >= 0 && currentSectionIndex < SECTIONS.length - 1;
  const currentSectionLabel = labelBySectionKey[currentSection] || currentSection;
  const lastSavedText = React.useMemo(
    () => {
      void clockTick;
      return lastSavedAt ? formatRelativeTime(lastSavedAt) : '未保存';
    },
    [lastSavedAt, clockTick, formatRelativeTime]
  );

  const handleGoPrev = () => {
    if (!canGoPrev) return;
    const nextKey = SECTIONS[currentSectionIndex - 1]?.key;
    if (nextKey) handleSectionChange(nextKey);
  };
  const handleGoNext = () => {
    if (!canGoNext) return;
    const nextKey = SECTIONS[currentSectionIndex + 1]?.key;
    if (nextKey) handleSectionChange(nextKey);
  };

  const handleResetCurrentSection = () => {
    const keys = getSectionResetFieldPaths(currentSection);
    if (keys.length === 0) return;
    form.resetFields(keys as (string | number | (string | number)[])[]);
    computeCompletion(form.getFieldsValue(true) as FormValues);
    message.success('已清空本板块内容');
    console.log('[Session] 已重置板块', currentSection);
  };

  if (loading && !isValidId) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <InterviewLayout
      navigation={
        <NavigationPanel
          currentSection={currentSection}
          onSectionChange={handleSectionChange}
          sections={sections}
          progress={progress}
          onExport={handlePreview}
          onGoHome={() => navigate('/')}
          onGoInterviewStart={() => navigate('/sessions')}
        />
      }
      editor={
        <>
          <div className="interview-editor-shell">
            <div className="interview-editor-header">
              <div className="interview-editor-header-inner">
                <div>
                  <div className="interview-editor-header-title">当前编辑：{currentSectionLabel}</div>
                  <div className="interview-editor-header-subtitle">上一次保存：{lastSavedText}</div>
                </div>
                <Space size={8}>
                  <Tooltip title="上一模块">
                    <Button icon={<ArrowLeftOutlined />} onClick={handleGoPrev} disabled={!canGoPrev} />
                  </Tooltip>
                  <Tooltip title="下一模块">
                    <Button icon={<ArrowRightOutlined />} onClick={handleGoNext} disabled={!canGoNext} />
                  </Tooltip>
                </Space>
              </div>
            </div>

            <div className="interview-editor-body">
              <div className="interview-editor-main">
                <Form
                  form={form}
                  layout="vertical"
                  onValuesChange={(changedValues) => {
                    computeCompletion(form.getFieldsValue(true) as FormValues);
                    if (!isValidId) return;
                    const changed = changedValues as unknown;
                    if (changed && typeof changed === 'object' && Object.prototype.hasOwnProperty.call(changed as Record<string, unknown>, 'presentIllness')) {
                      if (autoSaveDebounceRef.current) window.clearTimeout(autoSaveDebounceRef.current);
                      autoSaveDebounceRef.current = window.setTimeout(() => {
                        void handleSave(true, true);
                      }, 1200);
                    }
                  }}
                >
                  <EditorPanel
                    currentSection={currentSection}
                    currentSectionLabel={currentSectionLabel}
                    showResetButton={false}
                  />
                </Form>

                <AssistantOverlay />

                <Modal
                  title={
                    <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 600, color: '#1e40af' }}>
                      病历预览
                    </div>
                  }
                  open={showPreview}
                  onCancel={() => setShowPreview(false)}
                  footer={[
                    <Button key="close" onClick={() => setShowPreview(false)}>关闭</Button>,
                    <Button
                      key="copyText"
                      onClick={() => {
                        navigator.clipboard.writeText(previewPlainText || '');
                        message.success('已复制纯文本到剪贴板');
                      }}
                    >
                      复制纯文本
                    </Button>,
                    <Button
                      key="copyMd"
                      type="primary"
                      onClick={() => {
                        navigator.clipboard.writeText(previewContent);
                        message.success('已复制到剪贴板');
                      }}
                    >
                      复制Markdown
                    </Button>
                  ]}
                  width={900}
                  styles={{ body: { padding: 0, background: '#fff' } }}
                >
                  <div className="medical-record" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {previewContent}
                    </ReactMarkdown>
                  </div>
                </Modal>
              </div>
            </div>

            <div className="interview-editor-footer-spacer" />
          </div>

          <div className="interview-editor-footer">
            <div className="interview-editor-footer-inner">
              <Space size={12}>
                <Button icon={<SaveOutlined />} onClick={() => handleSave(false)}>保存</Button>
                <Button type="primary" icon={<EyeOutlined />} onClick={handlePreview}>预览</Button>
                <Popconfirm
                  title="确定要清空本板块所有已填写内容吗？"
                  okText="确定"
                  cancelText="取消"
                  onConfirm={handleResetCurrentSection}
                >
                  <Button danger icon={<UndoOutlined />}>重置本板块</Button>
                </Popconfirm>
              </Space>
            </div>
          </div>
        </>
      }
    />
  );
};

export default Session;
