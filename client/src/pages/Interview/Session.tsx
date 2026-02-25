import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { App as AntdApp, Form, Button, Space, Tooltip, Popconfirm } from 'antd';
import Loader from '../../components/common/Loader';
import LazyModal from '../../components/lazy/LazyModal';
import { ArrowLeftOutlined, ArrowRightOutlined, EyeOutlined, FilePdfOutlined, FileWordOutlined, UndoOutlined, RobotOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import LazyMarkdown from '../../components/LazyMarkdown';
import api, { getBlob, type ApiResponse, unwrapData } from '../../utils/api';
import logger from '../../utils/logger';

import InterviewLayout from './components/Layout/InterviewLayout';
import NavigationPanel from './components/Navigation/NavigationPanel';
import type { SectionStatus } from './components/Navigation/NavigationPanel';
import EditorPanel from './components/Editor/EditorPanel';
import AssistantOverlay from './components/Assistant/AssistantOverlay';
import { useAssistantStore, type ModuleKey, type KnowledgeContext } from '../../store/assistant.store';
import { buildHpiNarrative } from '../../utils/narrative';


type DateValue = string | number | Date | Dayjs | null | undefined;

interface FormValues {
  name?: string;
  gender?: string;
  age?: number;
  ageUnit?: '岁' | '月' | '岁月';
  ageYears?: number;
  ageMonthsTotal?: number;
  ageMonthsPart?: number;
  ageDisplayText?: string;
  ageDisplayBackupText?: string;
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
    noDiseaseHistory?: boolean;
    noSurgeriesTrauma?: boolean;
    noTransfusions?: boolean;
    noAllergies?: boolean;
  };
  personalHistory?: {
    birthplace?: string;
    residence?: string;
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
      none?: boolean;
      exams?: { name?: string; date?: DateValue; institution?: string; result?: string; image?: string }[];
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
  const { modal, message } = AntdApp.useApp();
  const setModule = useAssistantStore(s => s.setModule);
  const setProgress = useAssistantStore(s => s.setProgress);
  const setPanel = useAssistantStore(s => s.setPanel);
  const setNewMessage = useAssistantStore(s => s.setNewMessage);
  const setActions = useAssistantStore(s => s.setActions);
  const setKnowledgeContext = useAssistantStore(s => s.knowledge.setKnowledgeContext);
  const setKnowledgeContexts = useAssistantStore(s => s.knowledge.setKnowledgeContexts);
  const setDiagnosisSuggestions = useAssistantStore(s => s.knowledge.setDiagnosisSuggestions);
  const setKnowledgeMappings = useAssistantStore(s => s.knowledge.setKnowledgeMappings);
  const setKnowledgeLoading = useAssistantStore(s => s.knowledge.setKnowledgeLoading);
  const setKnowledgeError = useAssistantStore(s => s.knowledge.setKnowledgeError);

  // Fetch Mappings
  // Mappings are loaded in the main loading effect below
  
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isValidId, setIsValidId] = useState<boolean | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>('draft');
  const [currentSection, setCurrentSection] = useState('general');
  const [showPreview, setShowPreview] = useState(false);
  const hasNewMessage = useAssistantStore(s => s.hasNewMessage);
  const [previewContent, setPreviewContent] = useState('');
  const [previewPlainText, setPreviewPlainText] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const previewHistoryPushedRef = useRef(false);
  const previewPopStateHandlerRef = useRef<((e: PopStateEvent) => void) | null>(null);
  const [sections, setSections] = useState<SectionStatus[]>(() => SECTIONS.map(s => ({
    key: s.key,
    label: s.label,
    isCompleted: false,
    status: 'not_started',
    progress: 0,
  })));
  const [progress, setLocalProgress] = useState(0);
  const [showAssistant, setShowAssistant] = useState(false);
  const autoSaveDebounceRef = useRef<number | null>(null);
  const linkageCheckDebounceRef = useRef<number | null>(null);
  const basicCheckDebounceRef = useRef<number | null>(null);
  const panelUpdateDebounceRef = useRef<number | null>(null);
  const isHydratingRef = useRef(false);
  
  const labelBySectionKey = React.useMemo<Record<string, string>>(
    () => Object.fromEntries(SECTIONS.map(s => [s.key, s.label])),
    []
  );

  const closePreview = useCallback(() => {
    const handler = previewPopStateHandlerRef.current;
    if (handler) {
      window.removeEventListener('popstate', handler);
      previewPopStateHandlerRef.current = null;
    }
    setShowPreview(false);
    if (previewHistoryPushedRef.current) {
      previewHistoryPushedRef.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    if (!showPreview) return;

    if (!previewHistoryPushedRef.current) {
      const currentState = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.pushState({ ...currentState, __msia_preview: true }, document.title);
      previewHistoryPushedRef.current = true;
    }

    const handler = () => {
      const currentState = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.pushState({ ...currentState, __msia_preview: true }, document.title);
    };
    previewPopStateHandlerRef.current = handler;
    window.addEventListener('popstate', handler);

    return () => {
      window.removeEventListener('popstate', handler);
      if (previewPopStateHandlerRef.current === handler) previewPopStateHandlerRef.current = null;
    };
  }, [showPreview]);

  useEffect(() => {
    return () => {
      if (autoSaveDebounceRef.current) window.clearTimeout(autoSaveDebounceRef.current);
      if (linkageCheckDebounceRef.current) window.clearTimeout(linkageCheckDebounceRef.current);
      if (basicCheckDebounceRef.current) window.clearTimeout(basicCheckDebounceRef.current);
      if (panelUpdateDebounceRef.current) window.clearTimeout(panelUpdateDebounceRef.current);
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
        ['pastHistory', 'noDiseaseHistory'],
        ['pastHistory', 'infectiousHistory'],
        ['pastHistory', 'pmh_other'],
        ['pastHistory', 'illnessHistory'],
        ['pastHistory', 'surgeries'],
        ['pastHistory', 'noSurgeriesTrauma'],
        ['pastHistory', 'transfusions'],
        ['pastHistory', 'noTransfusions'],
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
    try {
      const snapshot = form.getFieldsValue(true) as FormValues;
      computeCompletion(snapshot, { level: 'deep', focusedSectionKey: currentSection });
      computeCompletion(snapshot, { level: 'linkage', focusedSectionKey: currentSection });
    } catch (e) {
      logger.error('[Session] 板块切换前深度检测失败', e);
    }
    // 先保存当前板块数据
    if (isValidId && id && id !== 'new') {
      try {
        await handleSave(true, true);
      } catch (e) {
        logger.error('[Session] 板块切换自动保存失败', e);
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
  const watchedCcSymptom = Form.useWatch(['chiefComplaint', 'symptom'], form) as string | undefined;
  const watchedGender = Form.useWatch('gender', form) as string | undefined;
  const watchedAge = Form.useWatch('age', form) as number | undefined;
  const knowledgeContext = useAssistantStore(s => s.knowledge.context);
  const watchedAssociated = Form.useWatch(['presentIllness', 'associatedSymptoms'], form) as string[] | undefined;
  const watchedRos = Form.useWatch(['reviewOfSystems'], form) as Record<string, { symptoms?: string[]; details?: string }> | undefined;
  const watchedIllnessHistory = Form.useWatch(['pastHistory', 'illnessHistory'], form) as string | undefined;
  const watchedInfectiousHistory = Form.useWatch(['pastHistory', 'infectiousHistory'], form) as string | undefined;

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
    if (sectionKey === 'auxiliary_exam') {
      const ae = form.getFieldValue(['auxiliaryExams']) as unknown;
      const obj = (ae && typeof ae === 'object') ? (ae as Record<string, unknown>) : {};
      const isNone = Boolean(obj.none);
      const summary = typeof obj.summary === 'string' ? obj.summary : '';
      const exams = (obj.exams as unknown) || [];
      const hasSummary = summary.trim().length > 0;
      const hasExam = Array.isArray(exams) && exams.some((ex) => {
        if (!ex || typeof ex !== 'object') return false;
        const r = ex as Record<string, unknown>;
        const name = typeof r.name === 'string' ? r.name.trim() : '';
        return name.length > 0 && Boolean(r.date);
      });
      if (isNone || hasSummary || hasExam) return [];
      return ['填写综述或添加记录，或勾选无辅助检查'];
    }

    if (sectionKey === 'past_history') {
      const ph = (form.getFieldValue(['pastHistory']) as unknown) || {};
      const obj = (ph && typeof ph === 'object') ? (ph as Record<string, unknown>) : {};

      const generalHealthOk = hasAssistantValue(obj.generalHealth);
      const diseaseOk =
        Boolean(obj.noDiseaseHistory) ||
        hasAssistantValue(obj.pmh_diseases) ||
        hasAssistantValue(obj.illnessHistory) ||
        hasAssistantValue(obj.infectiousHistory) ||
        hasAssistantValue(obj.pmh_other);

      const allergyOk = Boolean(obj.noAllergies) || hasAssistantValue(obj.allergies);
      const surgeryOk = Boolean(obj.noSurgeriesTrauma) || hasAssistantValue(obj.surgeries);
      const transfusionOk = Boolean(obj.noTransfusions) || hasAssistantValue(obj.transfusions);

      const missing: string[] = [];
      if (!generalHealthOk) missing.push('既往健康状况');
      if (!diseaseOk) missing.push('疾病史');
      if (!allergyOk) missing.push('过敏史');
      if (!surgeryOk) missing.push('手术史');
      if (!transfusionOk) missing.push('输血史');
      return missing;
    }

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
    const shouldShowNoneTip =
      sectionKey === 'past_history' &&
      pendingItems.some(x => x === '疾病史' || x === '过敏史' || x === '手术史' || x === '输血史');
    const validationText = pendingItems.length > 0
      ? `${`当前模块待补充：${pendingItems.join('、')}`}${shouldShowNoneTip ? '；如无相关史可勾选否认' : ''}`
      : '当前模块已填写较完整';

    const tips = (() => {
      if (sectionKey !== 'past_history') return undefined;
      const t: string[] = [];
      if (pendingItems.includes('疾病史')) t.push('无既往疾病可勾选否认疾病史');
      if (pendingItems.includes('过敏史')) t.push('无过敏史可勾选否认过敏史');
      if (pendingItems.includes('手术史')) t.push('无手术外伤史可勾选否认手术外伤史');
      if (pendingItems.includes('输血史')) t.push('无输血史可勾选否认输血史');
      return t.length > 0 ? t : undefined;
    })();

    setPanel({
      pendingItems,
      validationText,
      tips,
    });
    if (notify) setNewMessage(true);

  }, [getPendingItemsForSection, setNewMessage, setPanel]);

  // 单症状知识加载函数已由多症状汇总逻辑替代

  /**
   * refreshKnowledgeFromAllSymptoms
   * 汇总主诉、伴随症状与系统回顾中的所有症状，批量加载知识上下文并合并诊断建议
   */
  const refreshKnowledgeFromAllSymptoms = useCallback(async () => {
    const { nameToKey, synonyms } = useAssistantStore.getState().knowledge;
    const getKey = (n: string): string => {
      const name = String(n || '').trim();
      if (!name) return '';
      if (nameToKey[name]) return nameToKey[name];
      const canonical = synonyms[name];
      if (canonical && nameToKey[canonical]) return nameToKey[canonical];
      return name;
    };
    const extractKeysFromText = (text: string | undefined): string[] => {
      const t = String(text || '').trim();
      if (!t) return [];
      const termToKey: Record<string, string> = {};
      Object.keys(nameToKey).forEach((canonical) => {
        const key = nameToKey[canonical];
        if (canonical && key) termToKey[canonical] = key;
      });
      Object.keys(synonyms).forEach((syn) => {
        const canonical = synonyms[syn];
        const key = canonical ? nameToKey[canonical] : '';
        if (syn && key) termToKey[syn] = key;
      });
      const terms = Object.keys(termToKey).sort((a, b) => b.length - a.length);
      const found: string[] = [];
      for (const term of terms) {
        if (term && t.includes(term)) {
          const k = termToKey[term];
          if (k) found.push(k);
        }
      }
      // 去重
      return Array.from(new Set(found));
    };

    const keys = new Set<string>();
    if (watchedCcSymptom) {
      const k = getKey(watchedCcSymptom);
      if (k) keys.add(k);
    }
    const assoc = Array.isArray(watchedAssociated) ? watchedAssociated : [];
    assoc.forEach(k => {
      const t = String(k || '').trim();
      if (t) keys.add(t);
    });
    if (watchedRos && typeof watchedRos === 'object') {
      for (const sys of Object.values(watchedRos)) {
        const list = Array.isArray(sys?.symptoms) ? sys!.symptoms! : [];
        list.forEach(k => {
          const t = String(k || '').trim();
          if (t) keys.add(t);
        });
      }
    }
    // 解析自由文本中的症状（既往史/家族史）
    const freeTextKeys = [
      ...extractKeysFromText(watchedIllnessHistory),
      ...extractKeysFromText(watchedInfectiousHistory),
    ];
    freeTextKeys.forEach(k => { const t = String(k || '').trim(); if (t) keys.add(t); });

    const allKeys = Array.from(keys);
    if (allKeys.length === 0) {
      useAssistantStore.getState().knowledge.clearKnowledge();
      setDiagnosisSuggestions([]);
      setPanel({ diseases: [] });
      return;
    }

    type SymptomKnowledgeLite = {
      symptomKey: string;
      displayName: string;
      requiredQuestions?: unknown;
      associatedSymptoms?: unknown;
      redFlags?: unknown;
      physicalSigns?: unknown;
      updatedAt?: string;
    };
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      const contextsRaw = await Promise.all(
        allKeys.map(async (key) => {
          try {
            const kRes = await api.get(`/knowledge/${encodeURIComponent(key)}`) as ApiResponse<SymptomKnowledgeLite>;
            const k = unwrapData<SymptomKnowledgeLite>(kRes) || null;
            if (!k) return null;
            const toArr = (v: unknown): string[] => Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : [];
            return {
              name: k.displayName || key,
              questions: toArr(k.requiredQuestions),
              relatedSymptoms: toArr(k.associatedSymptoms),
              redFlags: toArr(k.redFlags),
              physicalSigns: toArr(k.physicalSigns),
              updatedAt: k.updatedAt,
            } as const;
          } catch (e) {
            logger.warn('[Session] 加载症状知识失败', { key, e });
            return null;
          }
        })
      );
      const contexts: KnowledgeContext[] = (contextsRaw.filter(Boolean) as Array<{
        name: string;
        questions?: string[];
        relatedSymptoms?: string[];
        redFlags?: string[];
        physicalSigns?: string[];
        updatedAt?: string;
      }>) as KnowledgeContext[];

      if (contexts.length > 0) {
        if (setKnowledgeContexts) {
          setKnowledgeContexts(contexts);
        } else {
          setKnowledgeContext(contexts[0]);
        }
        
        // 自动更新教学指导：提取必问问题
        const allQuestions = new Set<string>();
        contexts.forEach(c => {
          if (c.questions && Array.isArray(c.questions)) {
            c.questions.forEach(q => allQuestions.add(q));
          }
        });
        
        if (allQuestions.size > 0) {
          setPanel({ guidance: Array.from(allQuestions).slice(0, 10) });
        }
        
      } else {
        setKnowledgeContext(null);
        setKnowledgeError('暂无对应的知识库条目');
      }
    } catch (e) {
      logger.warn('[Session] 批量加载知识失败', e);
      setKnowledgeContext(null);
      setKnowledgeError('知识加载失败，请稍后重试');
    } finally {
      setKnowledgeLoading(false);
    }

    try {
      const names = (() => {
        const arr = setKnowledgeContexts ? (useAssistantStore.getState().knowledge.contexts || []) : [];
        if (Array.isArray(arr) && arr.length > 0) return arr.map(c => String(c?.name || '').trim()).filter(Boolean);
        // 兜底：使用 keys 作为名称
        return allKeys.slice(0);
      })();

      const sessionId = (() => {
        const n = Number(id);
        return Number.isFinite(n) && n > 0 ? n : null;
      })();
      const ageYearsFromForm = form.getFieldValue('ageYears');
      const normalizedAge = (() => {
        if (typeof ageYearsFromForm === 'number' && Number.isFinite(ageYearsFromForm)) return ageYearsFromForm;
        if (typeof watchedAge === 'number' && Number.isFinite(watchedAge)) return Math.max(0, Math.floor(watchedAge));
        return undefined;
      })();
      const sRes = await api.post('/diagnosis/suggest', { symptoms: names, age: normalizedAge, gender: watchedGender, sessionId }) as ApiResponse<string[]>;
      const suggestions = unwrapData<string[]>(sRes);
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        setDiagnosisSuggestions(suggestions);
        setPanel({ diseases: suggestions });
    
      } else {
        setDiagnosisSuggestions([]);
        setPanel({ diseases: [] });
      }
    } catch (e) {
      logger.warn('[Session] 获取诊断建议失败', e);
      setDiagnosisSuggestions([]);
      setPanel({ diseases: [] });
    }
  }, [form, id, setKnowledgeContext, setKnowledgeContexts, setKnowledgeError, setKnowledgeLoading, setPanel, setDiagnosisSuggestions, watchedAssociated, watchedCcSymptom, watchedRos, watchedAge, watchedGender, watchedIllnessHistory, watchedInfectiousHistory]);
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
    
      }

      const best = payload.matchedSymptoms?.find(s => s.knowledge) || payload.matchedSymptoms?.[0];
      if (best?.key) {
        let k = best.knowledge;
        if (!k) {
          try {
            const kRes = await api.get(`/knowledge/${best.key}`) as ApiResponse<SymptomKnowledgeLite>;
            k = unwrapData<SymptomKnowledgeLite>(kRes) || null;
          } catch (e) {
            logger.warn('[Session] 获取知识库失败', e);
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
      
        } else {
          setKnowledgeContext(null);
          setKnowledgeError('暂无对应的知识库条目');
        }
      } else {
        setKnowledgeContext(null);
      }

      const sessionId = (() => {
        const n = Number(id);
        return Number.isFinite(n) && n > 0 ? n : null;
      })();
      if (sessionId && names.length > 0) {
        try {
          const ageYearsFromForm = form.getFieldValue('ageYears');
          const normalizedAge = (() => {
            if (typeof ageYearsFromForm === 'number' && Number.isFinite(ageYearsFromForm)) return ageYearsFromForm;
            if (typeof watchedAge === 'number' && Number.isFinite(watchedAge)) return Math.max(0, Math.floor(watchedAge));
            return undefined;
          })();
          const sRes = await api.post('/diagnosis/suggest', { symptoms: names, age: normalizedAge, gender: watchedGender, sessionId }) as ApiResponse<string[]>;
          const suggestions = unwrapData<string[]>(sRes);
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            setDiagnosisSuggestions(suggestions);
            setPanel({ diseases: suggestions });
        
          } else {
            setDiagnosisSuggestions([]);
            setPanel({ diseases: [] });
        
          }
        } catch (e) {
          logger.warn('[Session] 获取诊断建议失败', e);
          setDiagnosisSuggestions([]);
          setPanel({ diseases: [] });
          message.warning('诊断建议获取失败');
        }
      } else {
        setDiagnosisSuggestions([]);
      }

      if (options.notify) setNewMessage(true);
    } catch (e) {
      logger.error('[Session] 解析主诉失败', e);
      if (options.notify) message.error('主诉解析失败');
      setKnowledgeError('主诉解析失败');
    } finally {
      setKnowledgeLoading(false);
    }
  }, [form, id, message, setDiagnosisSuggestions, setKnowledgeContext, setKnowledgeError, setKnowledgeLoading, setNewMessage, setPanel, watchedAge, watchedGender]);

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

  useEffect(() => {
    refreshKnowledgeFromAllSymptoms();
  }, [refreshKnowledgeFromAllSymptoms]);

  const assistantImproveChiefComplaint = useCallback(async () => {
    const text = String(form.getFieldValue(['chiefComplaint', 'text']) || '').trim();
    await analyzeChiefComplaint(text, { writeBack: true, notify: true });
  }, [analyzeChiefComplaint, form]);

  const assistantCheckCompleteness = useCallback(() => {
    updateAssistantPanelForSection(currentSection, true);
  }, [currentSection, updateAssistantPanelForSection]);

  /**
   * assistantOpenHelp
   * 打开“智能问诊助手帮助”说明窗口，使用居中显示以提升可读性
   */
  const assistantOpenHelp = useCallback(() => {
    const pending = getPendingItemsForSection(currentSection);
    modal.info({
      title: '智能问诊助手帮助',
      content: (
        <div>
          <div>当前模块：{labelBySectionKey[currentSection] || currentSection}</div>
          <div>建议优先补充：{pending.length > 0 ? pending.join('、') : '暂无'}</div>
        </div>
      ),
      okText: '知道了',
      centered: true
    });

  }, [currentSection, getPendingItemsForSection, labelBySectionKey, modal]);

  const knowledgeContexts = useAssistantStore(s => s.knowledge.contexts);
  const assistantRemindRedFlags = useCallback(() => {
    const unionFlags = (() => {
      const arr = Array.isArray(knowledgeContexts) && knowledgeContexts.length > 0
        ? knowledgeContexts.map(c => c?.redFlags || [])
        : [knowledgeContext?.redFlags || []];
      const set = new Set<string>();
      arr.forEach(list => (list || []).forEach(x => { const t = String(x || '').trim(); if (t) set.add(t); }));
      return Array.from(set);
    })();
    if (unionFlags.length > 0) {
      setPanel({ redFlagsTip: `红旗征：${unionFlags.slice(0, 6).map(String).join('、')}` });
      setNewMessage(true);
  
    } else {
      message.info('暂无红旗征提示');
    }
  }, [knowledgeContexts, knowledgeContext?.redFlags, message, setNewMessage, setPanel]);

  const assistantGuideReviewOfSystems = useCallback(() => {
    const unionQs = (() => {
      const arr = Array.isArray(knowledgeContexts) && knowledgeContexts.length > 0
        ? knowledgeContexts.map(c => c?.questions || [])
        : [knowledgeContext?.questions || []];
      const set = new Set<string>();
      arr.forEach(list => (list || []).forEach(x => { const t = String(x || '').trim(); if (t) set.add(t); }));
      return Array.from(set);
    })();
    if (unionQs.length > 0) {
      setPanel({ tips: unionQs.slice(0, 6) });
      setNewMessage(true);
  
    } else {
      message.info('暂无引导要点');
    }
  }, [knowledgeContexts, knowledgeContext?.questions, message, setNewMessage, setPanel]);

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
        updatedDetails[disease] = {};
      }
    });

    form.setFieldValue(['pastHistory', 'diseaseDetails'], updatedDetails);
    setPanel({ 
      tips: [`已创建 ${diseases.length} 项疾病详情字段`, '请根据实际情况补充确诊年份、控制情况与用药情况'],
      validationText: '既往史字段已准备完成，请补充真实信息'
    });
    setNewMessage(true);
    message.success('既往史字段已创建');

  }, [form, message, setNewMessage, setPanel]);

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

  }, [form, message, setNewMessage, setPanel]);

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

    if (parts.length === 0) {
      message.info('请先补充家族成员健康状况后再生成摘要');
      return;
    }
    const summary = parts.join('；');
    
    form.setFieldValue(['familyHistory', 'summary'], summary);
    setPanel({ 
      familySummary: summary,
      tips: ['家族史摘要已生成']
    });
    setNewMessage(true);
    message.success('家族史摘要生成完成');

  }, [form, message, setNewMessage, setPanel]);

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

  }, [form, message, setNewMessage, setPanel]);

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

  }, [form, message, setNewMessage, setPanel]);

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

  }, [form, message, setNewMessage, setPanel]);

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

  }, [form, message, setNewMessage, setPanel]);

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
    message,
    setActions,
    setNewMessage,
  ]);

  /**
   * 计算表单完成度
   * 使用加权算法，根据各板块重要性和填写完整度计算总体进度
   */
  const computeCompletion = useCallback((values: FormValues, options?: { level?: 'basic' | 'deep' | 'linkage'; focusedSectionKey?: string }) => {
    const level = options?.level || 'basic';
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

    /**
     * 判断文本是否表达“无/否认/未见”等明确阴性
     */
    const isExplicitNone = (x: unknown): boolean => {
      const s = typeof x === 'string' ? x.trim() : '';
      if (!s) return false;
      return /^(无|暂无|否认|未见|未发现|未曾|未行|未予|无特殊|无明显异常)/u.test(s);
    };

    /**
     * 判断手机号是否为11位数字
     */
    const isPhone11 = (x: unknown): boolean => {
      const s = typeof x === 'string' ? x.trim() : '';
      if (!s) return false;
      return /^\d{11}$/u.test(s);
    };

    /**
     * 判断年龄是否为合理范围
     */
    const isValidAge = (x: unknown): boolean => {
      if (typeof x !== 'number' || !Number.isFinite(x)) return false;
      return x >= 0 && x <= 150;
    };

    /**
     * 判断日期/时间是否可解析且有效
     */
    const isValidDateTime = (x: unknown): boolean => {
      if (x === null || x === undefined) return false;
      if (dayjs.isDayjs(x)) return x.isValid();
      if (typeof x === 'string' || typeof x === 'number' || x instanceof Date) return dayjs(x).isValid();
      return false;
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
     * 依据“问诊导航系统状态检查算法设计方案”计算板块状态与进度
     */
    const checkSection = (key: string): { progress: number; completed: boolean; started: boolean } => {
      const started = isSectionStarted(key);
      const passRate = (items: boolean[]): number => {
        if (items.length === 0) return 0;
        const ok = items.filter(Boolean).length;
        return ok / items.length;
      };

      const thresholdMap: Record<string, number> = {
        general: 0.95,
        chief_complaint: 0.85,
        hpi: 0.8,
        past_history: 0.9,
        personal_history: 0.75,
        marital_history: 0.7,
        family_history: 0.6,
        review_of_systems: 0.7,
        physical_exam: 0.8,
        specialist: 0.7,
        auxiliary_exam: 0.7,
      };
      const startThreshold = 0.3;

      if (key === 'general') {
        const identityOk = hasValidValue(values.name) && hasValidValue(values.gender) && isValidAge(values.age);
        const timeOk = isValidDateTime(values.birthDate) && isValidDateTime(values.generalInfo?.recordTime);
        const contactOk = isPhone11(values.phone);
        const auxOk = hasValidValue(values.ethnicity) && hasValidValue(values.maritalHistory?.status);

        const checks = [identityOk, timeOk, contactOk, auxOk];
        const progress = passRate(checks);
        const completed = progress >= 1;
        return { progress, completed, started: started || progress >= startThreshold };
      }

      if (key === 'chief_complaint') {
        const cc = values.chiefComplaint || {};
        const text = String(cc.text || '').trim();
        const symptom = String(cc.symptom || '').trim();
        const durationOk = typeof cc.durationNum === 'number' && Number.isFinite(cc.durationNum) && cc.durationNum > 0 && hasValidValue(cc.durationUnit);

        const structuredPart = symptom.length > 0 && durationOk;
        const naturalPart = text.length > 0 && text.length <= 20;
        const logicValidation = level === 'basic' ? structuredPart : (symptom.length === 0 ? false : text.includes(symptom));
        const qualityCheck = level === 'basic'
          ? Boolean(text)
          : /\d+(\.\d+)?\s*(天|日|周|月|年|小时|h|d|w|m|y)/iu.test(text);

        const dims = [structuredPart, naturalPart, logicValidation, qualityCheck];
        const progress = passRate(dims);

        const completedBasic = text.length > 0 && structuredPart && text.length <= 20;
        const completedDeep = naturalPart && dims.filter(Boolean).length >= 3;
        const completed = level === 'basic' ? completedBasic : completedDeep;

        return { progress, completed, started: started || progress >= startThreshold };
      }

      if (key === 'hpi') {
        const pi = values.presentIllness || {};
        const evolutionText = (pi.hpi_evolution ?? pi.evolution ?? pi.narrative) as unknown;
        const evolutionOk = hasValidValue(evolutionText) || isExplicitNone(evolutionText);

        const timelineOk = hasValidValue(pi.onsetTime) && (level === 'basic' ? true : (hasValidValue(pi.treatmentHistory) || evolutionOk));
        const symptomDescOk = hasValidValue(pi.location) || hasValidValue(pi.quality) || hasValidValue(pi.severity) || hasValidValue(pi.durationDetails) || hasValidValue(pi.factors);
        const associatedOk = hasValidValue(pi.associatedSymptoms) || hasValidValue(pi.associatedSymptomsDetails) || hasValidValue(pi.negativeSymptoms);
        const treatmentOk = hasValidValue(pi.treatmentHistory) || isExplicitNone(pi.treatmentHistory) || /未(诊治|治疗|就诊)/u.test(String(pi.treatmentHistory || '').trim());

        const checks = [timelineOk, symptomDescOk, evolutionOk, associatedOk, treatmentOk];
        const progress = passRate(checks);

        const completedBasic = checks.filter(Boolean).length >= 3 && hasValidValue(pi.onsetTime);
        const completedDeep = checks.filter(Boolean).length >= 4;
        const completed = level === 'basic' ? completedBasic : completedDeep;

        return { progress, completed, started: started || progress >= startThreshold };
      }

      if (key === 'past_history') {
        const ph = values.pastHistory || {};
        const generalHealthOk = hasValidValue(ph.generalHealth);

        const diseasesArr = Array.isArray(ph.pmh_diseases) ? ph.pmh_diseases : [];
        const diseasesOk =
          Boolean(ph.noDiseaseHistory) ||
          diseasesArr.length > 0 ||
          hasValidValue(ph.illnessHistory) ||
          hasValidValue(ph.infectiousHistory) ||
          hasValidValue(ph.pmh_other) ||
          isExplicitNone(ph.illnessHistory) ||
          isExplicitNone(ph.infectiousHistory) ||
          isExplicitNone(ph.pmh_other) ||
          diseasesArr.some(x => String(x || '').trim() === '无');

        const allergiesArr = Array.isArray(ph.allergies) ? ph.allergies : [];
        const allergiesOk =
          Boolean(ph.noAllergies) ||
          allergiesArr.length > 0 ||
          hasValidValue(ph.pmh_allergies) ||
          hasValidValue(ph.allergyDetails) ||
          isExplicitNone(ph.pmh_allergies) ||
          isExplicitNone(ph.allergyDetails) ||
          isExplicitNone(ph.allergyHistory);

        const surgeriesArr = Array.isArray(ph.surgeries) ? ph.surgeries : [];
        const surgeriesOk =
          Boolean(ph.noSurgeriesTrauma) ||
          surgeriesArr.length > 0 ||
          hasValidValue(ph.surgeryHistory) ||
          hasValidValue(ph.pmh_trauma_surgery) ||
          isExplicitNone(ph.surgeryHistory) ||
          isExplicitNone(ph.pmh_trauma_surgery);

        const transfusionsArr = Array.isArray(ph.transfusions) ? ph.transfusions : [];
        const transfusionsOk =
          Boolean(ph.noTransfusions) ||
          transfusionsArr.length > 0 ||
          hasValidValue(ph.transfusionHistory) ||
          isExplicitNone(ph.transfusionHistory) ||
          /否认输血史/u.test(String(ph.transfusionHistory || '').trim());

        const checks = [generalHealthOk, diseasesOk, allergiesOk, surgeriesOk, transfusionsOk];
        const progress = passRate(checks);
        const completed = checks.every(Boolean);
        return { progress, completed, started: started || progress >= startThreshold };
      }

      if (key === 'personal_history') {
        const pe = values.personalHistory || {};
        const birthplaceOk = hasValidValue((pe as unknown as { birthplace?: unknown }).birthplace) || hasValidValue(values.placeOfBirth);
        const residenceOk = hasValidValue(pe.residence);
        const basicInfoOk = birthplaceOk && residenceOk;

        const habitsOk = hasValidValue(pe.smoking_status) && hasValidValue(pe.alcohol_status);
        const workOk = hasValidValue(pe.work_cond) || isExplicitNone(pe.work_cond) || /无特殊/u.test(String(pe.work_cond || '').trim());

        const checks = [basicInfoOk, habitsOk, workOk];
        const progress = passRate(checks);
        const completed = checks.filter(Boolean).length >= 3;
        return { progress, completed, started: started || progress >= startThreshold };
      }

      if (key === 'marital_history') {
        const mh = values.maritalHistory;
        const men = values.menstrualHistory;
        const fh = values.fertilityHistory;
        const hasMarital = hasValidValue(mh?.status);
        const isFemale = values.gender === '女';
        const femaleNeeds = isFemale && typeof values.age === 'number' ? values.age >= 12 && values.age <= 50 : isFemale;
        const hasMenstrual = !femaleNeeds || hasValidValue(men?.age) || isValidDateTime(men?.lmp_date) || hasValidValue(men?.cycle) || Boolean(men?.isMenopause);
        const hasFertility = !femaleNeeds || hasValidValue(fh?.summary) || typeof fh?.living === 'number' || typeof fh?.term === 'number';
        const checks = [hasMarital, hasMenstrual, hasFertility];
        const progress = passRate(checks);
        const completed = progress >= (thresholdMap[key] || 0.8);
        return { progress, completed, started: started || progress >= startThreshold };
      }

      if (key === 'family_history') {
        const fh = values.familyHistory || {};
        const parentsOk = hasValidValue(fh.father) || hasValidValue(fh.mother) || isExplicitNone(fh.father) || isExplicitNone(fh.mother);
        const geneticOk = hasValidValue(fh.genetic) || hasValidValue(fh.similar) || isExplicitNone(fh.genetic) || isExplicitNone(fh.similar);
        const summaryOk = hasValidValue(fh.summary);
        const checks = [parentsOk, geneticOk, summaryOk];
        const progress = passRate(checks);
        const completed = progress >= (thresholdMap[key] || 0.6);
        return { progress, completed, started: started || progress >= startThreshold };
      }

      if (key === 'review_of_systems') {
        const ros = values.reviewOfSystems || {};
        const systems = Object.values(ros);
        const hasAny = systems.some(sys => hasValidValue(sys?.symptoms) || hasValidValue(sys?.details));
        const progress = hasAny ? 1 : 0;
        const completed = progress >= (thresholdMap[key] || 0.7);
        return { progress, completed, started: started || progress >= startThreshold };
      }

      if (key === 'physical_exam') {
        const vs = values.physicalExam?.vitalSigns || {};
        const vitalFields = [vs.temperature, vs.pulse, vs.respiration, vs.systolicBP, vs.diastolicBP];
        const vitalOk = vitalFields.filter(hasValidValue).length >= 3;
        const generalOk = hasValidValue(values.physicalExam?.general?.description);
        const otherOk =
          hasValidValue(values.physicalExam?.skinMucosa) ||
          hasValidValue(values.physicalExam?.neck) ||
          hasValidValue(values.physicalExam?.abdomen) ||
          hasValidValue(values.physicalExam?.neurological);
        const checks = [vitalOk, generalOk, otherOk];
        const progress = passRate(checks);
        const completed = progress >= (thresholdMap[key] || 0.8);
        return { progress, completed, started: started || progress >= startThreshold };
      }

      if (key === 'specialist') {
        const hasSpecialist = hasValidValue(values.physicalExam?.specialist);
        const hasDept = hasValidValue(values.physicalExam?.specialistDepartment);
        const progress = hasSpecialist || hasDept ? 1 : 0;
        const completed = progress >= (thresholdMap[key] || 0.7);
        return { progress, completed, started: started || progress >= startThreshold };
      }

      if (key === 'auxiliary_exam') {
        const ae = values.auxiliaryExams || {};
        const exams = Array.isArray(ae.exams) ? ae.exams : [];
        const hasExam = exams.some(ex => hasValidValue(ex?.name) && isValidDateTime(ex?.date));
        const hasSummary = hasValidValue(ae.summary);
        const noneOk = Boolean(ae.none);
        const checks = [noneOk || hasSummary || hasExam];
        const progress = passRate(checks);
        const completed = progress >= (thresholdMap[key] || 0.7);
        return { progress, completed, started: started || progress >= startThreshold };
      }

      const progress = 0;
      return { progress, completed: false, started };
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
      const r = checkSection(s.key);
      const sectionProgress = r.progress;
      const weight = sectionWeights[s.key] || 1;
      totalWeight += weight;
      weightedProgress += sectionProgress * weight;

      const completed = r.completed;
      const started = r.started;
      
      return {
        key: s.key,
        label: s.label,
        isCompleted: completed,
        status: completed ? 'completed' : (started ? 'in_progress' : 'not_started'),
        progress: sectionProgress,
      };
    });

    const nextProgress = totalWeight > 0 ? (weightedProgress / totalWeight) * 100 : 0;

    const linkageIssues: Record<string, string[]> = {};
    const addIssue = (sectionKey: string, issue: string) => {
      const k = String(sectionKey || '').trim();
      const msg = String(issue || '').trim();
      if (!k || !msg) return;
      if (!linkageIssues[k]) linkageIssues[k] = [];
      if (!linkageIssues[k].includes(msg)) linkageIssues[k].push(msg);
    };

    if (level === 'linkage') {
      if (isValidAge(values.age) && isValidDateTime(values.birthDate)) {
        const refTime = values.generalInfo?.recordTime ?? new Date();
        const birth = dayjs(values.birthDate as unknown as string);
        const ref = dayjs(refTime);
        const monthDiff = ref.isValid() && birth.isValid() ? ref.diff(birth, 'month', true) : NaN;
        const computedYears = Number.isFinite(monthDiff) ? Math.round((monthDiff / 12) * 100) / 100 : NaN;
        if (Number.isFinite(computedYears) && Math.abs(computedYears - Number(values.age)) > 1) {
          addIssue('general', `年龄与出生日期推算不一致（推算约${computedYears}岁）`);
        }
      }

      const { keyToName, nameToKey } = useAssistantStore.getState().knowledge;
      const normalizeSymptom = (input: string): string => {
        return String(input || '')
          .replace(/[“”"']/g, '')
          .replace(/[。；;]$/g, '')
          .trim();
      };
      const deriveMainSymptom = (text: string): string => {
        const cleaned = normalizeSymptom(text);
        if (!cleaned) return '';
        const cutIdx = cleaned.search(/\d/u);
        const head = (cutIdx >= 0 ? cleaned.slice(0, cutIdx) : cleaned)
          .replace(/[，,].*$/u, '')
          .replace(/^(反复发作|反复|持续|间断|阵发|突发|发作性)/u, '')
          .trim();
        return head;
      };

      const cc = values.chiefComplaint || {};
      const ccSymptom = normalizeSymptom(String(cc.symptom || '')) || deriveMainSymptom(String(cc.text || ''));
      const pi = values.presentIllness || {};
      const piText = [
        pi.location,
        pi.severity,
        pi.durationDetails,
        pi.factors,
        pi.treatmentHistory,
        pi.hpi_evolution,
        pi.evolution,
        pi.narrative,
        pi.associatedSymptomsDetails,
        pi.negativeSymptoms,
      ].map(x => String(x || '').trim()).filter(Boolean).join(' ');
      if (ccSymptom && hasValidValue(piText) && !piText.includes(ccSymptom)) {
        addIssue('chief_complaint', `主诉症状“${ccSymptom}”未在现病史内容中体现`);
        addIssue('hpi', `现病史内容未体现主诉症状“${ccSymptom}”`);
      }

      const associated = Array.isArray(pi.associatedSymptoms) ? pi.associatedSymptoms : [];
      const ros = values.reviewOfSystems || {};
      const systems = Object.values(ros);
      const hasAnyRos = systems.some(sys => hasValidValue(sys?.symptoms) || hasValidValue(sys?.details));
      if ((associated.length > 0 || hasValidValue(pi.negativeSymptoms)) && !hasAnyRos) {
        addIssue('review_of_systems', '现病史已记录伴随/阴性症状，但系统回顾未填写');
      }

      const durationToDays = (num: number, unit: string): number => {
        const u = String(unit || '').trim();
        if (!Number.isFinite(num) || num <= 0) return 0;
        if (u === '分钟') return num / (60 * 24);
        if (u === '小时') return num / 24;
        if (u === '天' || u === '日') return num;
        if (u === '周' || u === '星期') return num * 7;
        if (u === '月') return num * 30;
        if (u === '年') return num * 365;
        return 0;
      };
      const parseOnsetDate = (input: unknown, ref: unknown): dayjs.Dayjs | null => {
        const raw = String(input || '').trim();
        if (!raw) return null;
        const direct = dayjs(raw);
        if (direct.isValid()) return direct;
        const m = raw.match(/(\d+(?:\.\d+)?)\s*(分钟|小时|天|日|周|星期|月|年)\s*前/u);
        if (m) {
          const n = Number(m[1]);
          const unit = String(m[2] || '');
          const days = durationToDays(n, unit);
          if (days <= 0) return null;
          const base = isValidDateTime(ref) ? dayjs(ref as unknown as string) : dayjs();
          return base.subtract(days, 'day');
        }
        const m2 = raw.match(/^近\s*(\d+(?:\.\d+)?)\s*(分钟|小时|天|日|周|星期|月|年)/u);
        if (m2) {
          const n = Number(m2[1]);
          const unit = String(m2[2] || '');
          const days = durationToDays(n, unit);
          if (days <= 0) return null;
          const base = isValidDateTime(ref) ? dayjs(ref as unknown as string) : dayjs();
          return base.subtract(days, 'day');
        }
        return null;
      };

      const refTime = values.generalInfo?.recordTime ?? new Date();
      const ccDurNum = typeof cc.durationNum === 'number' && Number.isFinite(cc.durationNum) ? cc.durationNum : 0;
      const ccDurDays = durationToDays(ccDurNum, String(cc.durationUnit || ''));
      const onsetDate = parseOnsetDate(pi.onsetTime, refTime);
      if (ccDurDays > 0 && onsetDate) {
        const onsetDays = dayjs(refTime).diff(onsetDate, 'day', true);
        const diff = Math.abs(onsetDays - ccDurDays);
        const tolerance = Math.max(2, ccDurDays * 0.5);
        if (Number.isFinite(onsetDays) && onsetDays >= 0 && diff > tolerance) {
          addIssue('chief_complaint', `主诉病程约${ccDurNum}${String(cc.durationUnit || '')}，现病史起病时间推算约${Math.round(onsetDays)}天`);
          addIssue('hpi', `现病史起病时间与主诉病程不一致（差异约${Math.round(diff)}天）`);
        }
      }

      const ph = values.pastHistory || {};
      if (ph.noAllergies) {
        const filled =
          (Array.isArray(ph.allergies) && ph.allergies.length > 0) ||
          hasValidValue(ph.pmh_allergies) ||
          hasValidValue(ph.allergyDetails) ||
          hasValidValue(ph.allergyHistory);
        if (filled) addIssue('past_history', '既往史已勾选无过敏史，但仍填写了过敏信息');
      }

      const extractTokens = (text: string): string[] => {
        const raw = String(text || '').replace(/\r/g, '\n');
        return raw
          .split(/[\n,，、;；\s]+/u)
          .map(s => s.trim())
          .filter(s => s.length >= 2 && s.length <= 12);
      };
      const allergyTokens = new Set<string>();
      const allergiesArr = Array.isArray(ph.allergies) ? ph.allergies : [];
      for (const a of allergiesArr) {
        if (!a || typeof a !== 'object') continue;
        const r = a as Record<string, unknown>;
        for (const t of extractTokens(String(r.substance || r.allergen || ''))) allergyTokens.add(t);
      }
      for (const t of extractTokens(String(ph.pmh_allergies || ''))) allergyTokens.add(t);
      for (const t of extractTokens(String(ph.allergyDetails || ''))) allergyTokens.add(t);
      for (const t of extractTokens(String(ph.allergyHistory || ''))) allergyTokens.add(t);

      const tx = String(pi.treatmentHistory || '').trim();
      if (tx && allergyTokens.size > 0) {
        for (const token of Array.from(allergyTokens)) {
          if (token && tx.includes(token)) {
            addIssue('past_history', `既往史提示对“${token}”过敏，但现病史诊治经过提到该内容`);
            addIssue('hpi', `诊治经过提到“${token}”，请确认是否与既往过敏史冲突`);
          }
        }
      }

      const rosNone = Boolean((ros as Record<string, unknown>)?.none);
      if (rosNone && ccSymptom) {
        addIssue('review_of_systems', `系统回顾勾选无异常，但主诉为“${ccSymptom}”`);
        addIssue('chief_complaint', `主诉为“${ccSymptom}”时，系统回顾勾选无异常需复核`);
      }
      if (rosNone && associated.length > 0) {
        addIssue('review_of_systems', '系统回顾勾选无异常，但现病史已选择伴随症状');
        addIssue('hpi', '现病史已选择伴随症状，请同步核对系统回顾');
      }

      const symptomToSystems: Record<string, string[]> = {
        '发热': ['general'],
        '发冷': ['general'],
        '乏力': ['general', 'hematologic', 'endocrine'],
        '盗汗': ['general'],
        '体重减轻': ['general'],
        '体重增加': ['general'],
        '皮疹': ['skin'],
        '瘙痒': ['skin'],
        '色素沉着': ['skin'],
        '脱发': ['skin'],
        '多毛': ['skin'],
        '头痛': ['head_eent', 'neurological'],
        '头晕': ['head_eent', 'neurological', 'hematologic'],
        '视力障碍': ['head_eent'],
        '听力下降': ['head_eent'],
        '耳鸣': ['head_eent'],
        '鼻出血': ['head_eent', 'hematologic'],
        '咽痛': ['head_eent'],
        '声音嘶哑': ['head_eent'],
        '咳嗽': ['respiratory'],
        '咳痰': ['respiratory'],
        '咯血': ['respiratory'],
        '胸痛': ['respiratory', 'cardiovascular'],
        '呼吸困难': ['respiratory', 'cardiovascular'],
        '哮喘': ['respiratory'],
        '心悸': ['cardiovascular'],
        '胸闷': ['cardiovascular'],
        '水肿': ['cardiovascular', 'urinary'],
        '晕厥': ['cardiovascular', 'neurological'],
        '气短': ['cardiovascular'],
        '夜间阵发性呼吸困难': ['cardiovascular'],
        '食欲不振': ['digestive'],
        '恶心': ['digestive'],
        '呕吐': ['digestive'],
        '腹痛': ['digestive'],
        '腹胀': ['digestive'],
        '腹泻': ['digestive'],
        '便秘': ['digestive'],
        '呕血': ['digestive'],
        '黑便': ['digestive'],
        '黄疸': ['digestive'],
        '尿频': ['urinary'],
        '尿急': ['urinary'],
        '尿痛': ['urinary'],
        '血尿': ['urinary'],
        '排尿困难': ['urinary'],
        '尿量改变': ['urinary'],
        '颜面水肿': ['urinary'],
        '腰痛': ['urinary'],
        '皮肤出血点': ['hematologic'],
        '瘀斑': ['hematologic'],
        '牙龈出血': ['hematologic'],
        '多饮': ['endocrine'],
        '多食': ['endocrine'],
        '多尿': ['endocrine', 'urinary'],
        '体重改变': ['endocrine'],
        '怕热': ['endocrine'],
        '怕冷': ['endocrine'],
        '多汗': ['endocrine'],
        '毛发改变': ['endocrine'],
        '抽搐': ['neurological'],
        '意识障碍': ['neurological'],
        '失眠': ['neurological'],
        '记忆力下降': ['neurological'],
        '肢体麻木': ['neurological'],
        '瘫痪': ['neurological'],
        '关节痛': ['musculoskeletal'],
        '关节肿胀': ['musculoskeletal'],
        '关节僵硬': ['musculoskeletal'],
        '肌肉痛': ['musculoskeletal'],
        '肌肉萎缩': ['musculoskeletal'],
        '运动受限': ['musculoskeletal'],
      };

      const rosRec = ros && typeof ros === 'object' ? (ros as Record<string, unknown>) : {};
      const hasRosSelection = (sysKey: string, symptomKey: string, symptomName: string): boolean => {
        const sys = rosRec[sysKey];
        if (!sys || typeof sys !== 'object') return false;
        const r = sys as Record<string, unknown>;
        const arr = Array.isArray(r.symptoms) ? (r.symptoms as unknown[]) : [];
        const text = String(r.details || '').trim();
        const mappedKey = nameToKey?.[symptomName];
        return arr.includes(symptomKey) || (mappedKey ? arr.includes(mappedKey) : false) || arr.includes(symptomName) || (text ? text.includes(symptomName) : false);
      };

      if (ccSymptom && !rosNone) {
        const sysKeys = symptomToSystems[ccSymptom] || [];
        if (sysKeys.length > 0) {
          const symptomKey = String(nameToKey?.[ccSymptom] || ccSymptom);
          const ok = sysKeys.some(sysKey => hasRosSelection(sysKey, symptomKey, ccSymptom));
          if (!ok) {
            addIssue('review_of_systems', `系统回顾未体现主诉症状“${ccSymptom}”`);
            addIssue('hpi', `主诉症状“${ccSymptom}”建议在系统回顾中对应记录`);
          }
        }
      }

      if (associated.length > 0 && !rosNone) {
        for (const k of associated) {
          const name = String(keyToName?.[k] || k || '').trim();
          const sysKeys = symptomToSystems[name] || [];
          if (sysKeys.length === 0) continue;
          const ok = sysKeys.some(sysKey => hasRosSelection(sysKey, k, name));
          if (!ok) {
            addIssue('review_of_systems', `系统回顾未体现现病史伴随症状“${name}”`);
            addIssue('hpi', `伴随症状“${name}”建议在系统回顾中对应记录`);
          }
        }
      }
    }

    setSections((prev) => {
      const prevMap = new Map(prev.map(s => [s.key, s]));
      const shouldUpdateIssues = level === 'linkage';
      return nextSections.map((s) => {
        const prevS = prevMap.get(s.key);
        const nextHasError = shouldUpdateIssues ? Boolean(linkageIssues[s.key] && linkageIssues[s.key].length > 0) : prevS?.hasError;
        const nextIssues = shouldUpdateIssues ? (linkageIssues[s.key] || []) : prevS?.issues;
        return {
          ...s,
          hasError: nextHasError,
          issues: nextIssues,
        };
      });
    });
    setLocalProgress(nextProgress);
    setProgress(nextProgress);
    

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
        { key: 'hematologic', label: '血液系统' },
        { key: 'endocrine', label: '内分泌及代谢系统' },
        { key: 'neurological', label: '神经精神系统' },
        { key: 'musculoskeletal', label: '肌肉骨骼系统' },
      ];
      return systemsOrder.map(sys => {
        const data = (ros as Record<string, { symptoms?: string[]; details?: string } | undefined>)[sys.key];
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

    const ageText = (() => {
      const displayText = typeof val.ageDisplayText === 'string' ? val.ageDisplayText.trim() : '';
      if (displayText) return displayText;
      const years = typeof val.ageYears === 'number' && Number.isFinite(val.ageYears) ? val.ageYears : undefined;
      if (years != null) return `${years}岁`;
      if (val.age != null) return `${Math.round(Number(val.age) * 100) / 100}岁`;
      return '';
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
      `| 年龄 | ${escapeTableCell(ageText)} | 民族 | ${escapeTableCell(val.ethnicity)} |`,
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
      ...(surgeryLines.length > 0
        ? surgeryLines.map(s => `- ${escapeMarkdownText(escapeHtml(s))}`)
        : pastRec.noSurgeriesTrauma
          ? ['- 否认手术外伤史']
          : ['- 未记录']),
      '',
      '## 过敏史',
      '',
      ...(allergyText
        ? [`> 过敏史：${escapeHtml(allergyText)}`]
        : pastRec.noAllergies
          ? ['- 否认药物及食物过敏史']
          : ['- 未记录']),
      '',
      '## 输血史',
      '',
      ...(transfusionLines.length > 0
        ? transfusionLines.map(s => `- ${escapeHtml(s)}`)
        : pastRec.noTransfusions
          ? ['- 否认输血史']
          : ['- 未记录']),
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
    const ageText = (() => {
      const displayText = typeof val.ageDisplayText === 'string' ? val.ageDisplayText.trim() : '';
      if (displayText) return displayText;
      const unit = val.ageUnit;
      const years = typeof val.ageYears === 'number' && Number.isFinite(val.ageYears) ? val.ageYears : undefined;
      const monthsTotal = typeof val.ageMonthsTotal === 'number' && Number.isFinite(val.ageMonthsTotal) ? val.ageMonthsTotal : undefined;
      const monthsPart = typeof val.ageMonthsPart === 'number' && Number.isFinite(val.ageMonthsPart) ? val.ageMonthsPart : undefined;
      if (unit === '月' && monthsTotal != null) return `${monthsTotal}月`;
      if (unit === '岁月' && (years != null || monthsPart != null)) return `${years ?? 0}岁${monthsPart ?? 0}月`;
      if (unit === '岁' && years != null) return `${years}岁`;
      if (val.age != null) return `${Math.round(Number(val.age) * 100) / 100}岁`;
      return '';
    })();
    lines.push(`姓名：${val.name || '未填写'}  性别：${val.gender || '未填写'}  年龄：${ageText || '未填写'}`);
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

    lines.push('系统回顾');
    const ros = val.reviewOfSystems;
    const rosOrder = [
      { key: 'respiratory', label: '呼吸系统' },
      { key: 'cardiovascular', label: '循环系统' },
      { key: 'digestive', label: '消化系统' },
      { key: 'urinary', label: '泌尿系统' },
      { key: 'hematologic', label: '血液系统' },
      { key: 'endocrine', label: '内分泌及代谢系统' },
      { key: 'neurological', label: '神经精神系统' },
      { key: 'musculoskeletal', label: '肌肉骨骼系统' },
    ];
    if (!ros || Object.keys(ros).length === 0) {
      lines.push('未录入。');
    } else {
      rosOrder.forEach(sys => {
        const data = (ros as Record<string, { symptoms?: string[]; details?: string } | undefined>)[sys.key];
        if (!data) {
          lines.push(`${sys.label}：未询问。`);
          return;
        }
        const positives =
          data.symptoms && data.symptoms.length > 0
            ? `有${data.symptoms.map(k => keyToNameMap[k] || k).join('、')}`
            : '无特殊症状';
        const details = data.details ? `，${data.details}` : '';
        lines.push(`${sys.label}：${ensureEnd(`${positives}${details}`)}`);
      });
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
    const load = async () => {
      const isNew = !id || id === 'new';
      setLoading(!isNew);
      setLoadingProgress(isNew ? 100 : 0);

      try {
        // Phase 1: Load Mappings (0-40%)
        if (!isNew) setLoadingProgress(10);
        type MappingPayload = { nameToKey: Record<string, string>; synonyms: Record<string, string> };
        const mapRes = await api.get('/mapping/symptoms') as ApiResponse<MappingPayload>;
        const mapPayload = unwrapData<MappingPayload>(mapRes);
        
        if (mapPayload) {
             const inverted: Record<string, string> = {};
             for (const [name, key] of Object.entries(mapPayload.nameToKey || {})) {
               if (key && name && !inverted[key]) inverted[key] = name;
             }
             setKnowledgeMappings({ 
               nameToKey: mapPayload.nameToKey || {}, 
               keyToName: inverted,
               synonyms: mapPayload.synonyms || {}
             });
         
        } else {
             setKnowledgeMappings({ nameToKey: {}, keyToName: {}, synonyms: {} });
        }
      } catch {
         setKnowledgeMappings({ nameToKey: {}, keyToName: {} });
      }

      if (!isNew) setLoadingProgress(40);

      // Phase 2: Load Session (40-100%)
      if (isNew) {
        setLoading(false);
        return;
      }

      setLoadingProgress(50);
      
      try {
        const res = await api.get(`/sessions/${id}`) as ApiResponse<SessionRes>;
        const data = unwrapData<SessionRes>(res);
        
        setLoadingProgress(90);
        
        // Wait a bit to show 100%
        setLoadingProgress(100);
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
                   surgeries: Array.isArray(pastHistory.surgeries)
                     ? pastHistory.surgeries.map(s => ({
                         ...s,
                         date: s?.date
                           ? (dayjs.isDayjs(s.date) ? s.date : dayjs(s.date))
                           : undefined,
                       }))
                     : [],
                   transfusions: Array.isArray(pastHistory.transfusions)
                     ? pastHistory.transfusions.map(t => ({
                         ...t,
                         date: t?.date
                           ? (dayjs.isDayjs(t.date) ? t.date : dayjs(t.date))
                           : undefined,
                       }))
                     : [],
                   allergies: Array.isArray(pastHistory.allergies) ? pastHistory.allergies : [],
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
                   exams: Array.isArray(auxiliaryExams.exams)
                     ? auxiliaryExams.exams.map(ex => ({
                         ...ex,
                         date: ex?.date
                           ? (dayjs.isDayjs(ex.date) ? ex.date : dayjs(ex.date))
                           : undefined,
                       }))
                     : [],
                 }
               : undefined,
          };

          isHydratingRef.current = true;
          form.setFieldsValue(formData);
          // 使用 formData 直接计算完成度，避免 setFieldsValue 异步导致的获取不到最新值
          computeCompletion(formData as FormValues, { level: 'deep' });
          setLastSavedAt(Date.now());
          window.setTimeout(() => {
            isHydratingRef.current = false;
            updateAssistantPanelForSection('general', false);
          }, 0);
        } else {
          setIsValidId(false);
          message.error('未找到该会话记录');
        }
      } catch (err: unknown) {
        logger.error('[Session] 加载会话失败:', err);
        setIsValidId(false);
        
        // 处理不同错误类型
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
          const status = axiosError.response?.status;
          const serverMessage = axiosError.response?.data?.message;
          
          if (status === 403) {
            message.error(serverMessage || '无权访问该会话');
          } else if (status === 404) {
            message.error('未找到该会话记录');
          } else {
            message.error(serverMessage || '加载失败');
          }
        } else {
          message.error('加载失败，请检查网络连接');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, form, computeCompletion, message, setKnowledgeMappings, updateAssistantPanelForSection]);

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
      computeCompletion(values, { level: 'deep' });
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
  
      await api.patch(`/sessions/${id}`, normalized);
      
      if (!silent) message.success('保存成功');

      setLastSavedAt(Date.now());
    } catch (err) {
      const e = err as unknown;
      const asRecord = (v: unknown): Record<string, unknown> | null =>
        v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
      const rec = asRecord(e);
      const response = rec ? asRecord(rec.response) : null;
      const statusRaw = response && typeof response === 'object' && 'status' in response
        ? (response as Record<string, unknown>).status
        : undefined;
      const status = typeof statusRaw === 'number' ? statusRaw : Number(statusRaw || 0);
      const respData = response && typeof response === 'object' && 'data' in response
        ? (response as Record<string, unknown>).data
        : undefined;
      logger.error('[Session] 保存失败', { message: rec?.message, status, data: respData });
      if (status === 401) {
        message.error('登录已过期或无权限，请重新登录');
        try {
          const p = window.location.pathname || `/interview/${id}`;
          // 在拦截器可能跳转的同时，显式导航以增强可靠性
          navigate(`/login?redirect=${encodeURIComponent(p)}`, { replace: true });
        } catch {
          // ignore
        }
      } else {
        if (!silent) message.error('保存失败');
      }
    } finally {
      if (!isAutoSave) setLoading(false);
    }
  }, [id, form, normalizePayload, computeCompletion, message, navigate]);

  const handleArchive = useCallback(async () => {
    if (!isValidId || !id || id === 'new') return;
    if (String(sessionStatus || '').toLowerCase() === 'archived') return;
    setLoading(true);
    try {
      await handleSave(true, true);
      await api.patch(`/sessions/${id}`, { status: 'archived' });
      setSessionStatus('archived');
      message.success('已归档');
  
    } catch (err) {
      const e = err as unknown;
      const asRecord = (v: unknown): Record<string, unknown> | null =>
        v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
      const rec = asRecord(e);
      const response = rec ? asRecord(rec.response) : null;
      logger.error('[Session] 归档失败', {
        message: rec?.message,
        status: response?.status,
        data: response?.data,
      });
      message.error('归档失败');
    } finally {
      setLoading(false);
    }
  }, [id, isValidId, message, sessionStatus, handleSave]);

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
    computeCompletion(val as FormValues, { level: 'linkage' });
    const md = generateReportMarkdown(val);
    setPreviewContent(md);
    setPreviewPlainText(generateReportPlainText(val));
    setShowPreview(true);
  };

  /**
   * parseDownloadFilename
   * 从响应头 Content-Disposition 中解析文件名，兼容 filename 与 filename* 两种写法
   */
  const parseDownloadFilename = (contentDisposition: unknown): string | null => {
    const raw = String(contentDisposition || '').trim();
    if (!raw) return null;

    const m1 = /filename\*\s*=\s*UTF-8''([^;]+)/iu.exec(raw);
    if (m1 && m1[1]) {
      try {
        return decodeURIComponent(m1[1]).trim() || null;
      } catch {
        return String(m1[1]).trim() || null;
      }
    }

    const m2 = /filename\s*=\s*("?)([^";]+)\1/iu.exec(raw);
    if (m2 && m2[2]) return String(m2[2]).trim() || null;
    return null;
  };

  /**
   * downloadBlobAsFile
   * 将后端返回的二进制数据以“下载文件”的方式保存到本地
   */
  const downloadBlobAsFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /**
   * handleExportPdf
   * 调用后端导出接口生成PDF并下载（文件流）
   */
  const handleExportPdf = async () => {
    const sessionId = Number(id);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      message.warning('当前记录尚未保存，无法导出');
      return;
    }


    try {
      const resp = await getBlob(`/sessions/${sessionId}/export/pdf`);
      const blob: Blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data || ''], { type: 'application/pdf' });
      const cd = resp.headers?.['content-disposition'] || resp.headers?.['Content-Disposition'];
      const filename = parseDownloadFilename(cd) || `病历_${sessionId}_${dayjs().format('YYYYMMDD_HHmm')}.pdf`;
      downloadBlobAsFile(blob, filename);
      message.success('导出PDF成功');
    } catch (e) {
      logger.error('[Session] 导出PDF失败', e);
      message.error('导出PDF失败');
    }
  };

  /**
   * handleExportWord
   * 调用后端导出接口生成Word并下载（文件流）
   */
  const handleExportWord = async () => {
    const sessionId = Number(id);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      message.warning('当前记录尚未保存，无法导出');
      return;
    }


    try {
      const resp = await getBlob(`/sessions/${sessionId}/export/word`);
      const blob: Blob = resp.data instanceof Blob
        ? resp.data
        : new Blob([resp.data || ''], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const cd = resp.headers?.['content-disposition'] || resp.headers?.['Content-Disposition'];
      const filename = parseDownloadFilename(cd) || `病历_${sessionId}_${dayjs().format('YYYYMMDD_HHmm')}.docx`;
      downloadBlobAsFile(blob, filename);
      message.success('导出Word成功');
    } catch (e) {
      logger.error('[Session] 导出Word失败', e);
      message.error('导出Word失败');
    }
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
    computeCompletion(form.getFieldsValue(true) as FormValues, { level: 'basic' });
    message.success('已清空本板块内容');

  };

  if (loading && !isValidId) {
    return <Loader fullscreen percent={loadingProgress} />;
  }

  return (
    <InterviewLayout
        navigation={
          <NavigationPanel
            currentSection={currentSection}
            onSectionChange={handleSectionChange}
            sections={sections}
            progress={progress}
            onGoHome={() => navigate('/home')}
            onGoInterviewStart={() => navigate('/sessions')}
          />
        }
        editor={
        <>
          <div className="interview-editor-shell">
            <div className="interview-editor-header" style={{ position: 'sticky', top: 0, zIndex: 19 }}>
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
                    if (isHydratingRef.current) return;
                    if (basicCheckDebounceRef.current) window.clearTimeout(basicCheckDebounceRef.current);
                    basicCheckDebounceRef.current = window.setTimeout(() => {
                      computeCompletion(form.getFieldsValue(true) as FormValues, { level: 'basic' });
                    }, 200);
                    if (panelUpdateDebounceRef.current) window.clearTimeout(panelUpdateDebounceRef.current);
                    panelUpdateDebounceRef.current = window.setTimeout(() => {
                      updateAssistantPanelForSection(currentSection, false);
                    }, 250);
                    const changed = changedValues as unknown;
                    const shouldLinkageCheck = (() => {
                      if (!changed || typeof changed !== 'object') return false;
                      const r = changed as Record<string, unknown>;
                      return (
                        Object.prototype.hasOwnProperty.call(r, 'chiefComplaint') ||
                        Object.prototype.hasOwnProperty.call(r, 'presentIllness') ||
                        Object.prototype.hasOwnProperty.call(r, 'pastHistory') ||
                        Object.prototype.hasOwnProperty.call(r, 'reviewOfSystems') ||
                        Object.prototype.hasOwnProperty.call(r, 'age') ||
                        Object.prototype.hasOwnProperty.call(r, 'gender') ||
                        Object.prototype.hasOwnProperty.call(r, 'birthDate') ||
                        Object.prototype.hasOwnProperty.call(r, 'generalInfo')
                      );
                    })();
                    if (shouldLinkageCheck) {
                      if (linkageCheckDebounceRef.current) window.clearTimeout(linkageCheckDebounceRef.current);
                      linkageCheckDebounceRef.current = window.setTimeout(() => {
                        computeCompletion(form.getFieldsValue(true) as FormValues, { level: 'linkage', focusedSectionKey: currentSection });
                    
                      }, 900);
                    }
                    if (!isValidId) return;
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

                <div className="assistant-fab">
                  <Tooltip title={hasNewMessage ? '问诊助手有新提示' : '打开问诊助手'}>
                    <Button
                      type="primary"
                      shape="round"
                      icon={<RobotOutlined />}
                      onClick={() => {
                        setShowAssistant(true);
                        setNewMessage(false);
                    
                      }}
                    >
                      问诊助手
                    </Button>
                  </Tooltip>
                </div>

                <AssistantOverlay open={showAssistant} onClose={() => setShowAssistant(false)} />

                <LazyModal
                  title={
                    <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 600, color: '#1e40af' }}>
                      病历预览
                    </div>
                  }
                  open={showPreview}
                  closable={false}
                  maskClosable={false}
                  keyboard={false}
                  onCancel={() => {
                
                  }}
                  footer={[
                    <Button key="close" onClick={closePreview}>关闭</Button>,
                    <Button
                      key="copyText"
                      onClick={() => {
                        navigator.clipboard.writeText(previewPlainText || '');
                        message.success('已复制纯文本到剪贴板');
                      }}
                    >
                      复制纯文本
                    </Button>,
                    <Button key="exportWord" icon={<FileWordOutlined />} onClick={handleExportWord}>
                      导出Word
                    </Button>,
                    <Button key="exportPdf" icon={<FilePdfOutlined />} onClick={handleExportPdf}>
                      导出PDF
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
                    <LazyMarkdown content={previewContent} />
                  </div>
                </LazyModal>
              </div>
            </div>

            <div className="interview-editor-footer-spacer" />
          </div>

          <div className="interview-editor-footer">
            <div className="interview-editor-footer-inner">
              <Space size={12}>
                <Button type="primary" icon={<EyeOutlined />} onClick={handlePreview}>预览病历</Button>
                <Popconfirm
                  title="确定将该问诊记录归档吗？"
                  okText="归档"
                  cancelText="取消"
                  onConfirm={() => void handleArchive()}
                >
                  <Button disabled={!isValidId || !id || id === 'new' || String(sessionStatus || '').toLowerCase() === 'archived'}>
                    归档记录
                  </Button>
                </Popconfirm>
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
