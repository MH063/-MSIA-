import React, { useState, useEffect, useCallback, useRef } from 'react';
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
}

type SymptomPrompt = {
  questions: string[];
  relatedSymptoms: string[];
  redFlags: string[];
  physicalSigns?: string[];
};

const symptomPrompts: Record<string, SymptomPrompt> = {
  "腹痛": {
    questions: [
      "疼痛的具体部位在哪里？",
      "疼痛的性质（绞痛/钝痛/刺痛）？",
      "有无放射痛（如向背部、肩部放射）？",
      "与进食有什么关系？",
      "什么情况下会缓解或加重？"
    ],
    relatedSymptoms: ["恶心呕吐", "腹泻", "发热", "黄疸"],
    redFlags: ["剧烈腹痛伴休克体征", "腹膜刺激征(板状腹)", "呕血或黑便"],
    physicalSigns: ["腹部压痛/反跳痛/肌紧张", "肠鸣音（活跃/减弱/消失）", "腹部包块", "Murphy征"]
  },
  "发热": {
    questions: [
      "最高体温是多少？",
      "热型（稽留热/弛张热/间歇热）？",
      "是否伴有寒战？",
      "退热时是否大量出汗？"
    ],
    relatedSymptoms: ["咳嗽", "头痛", "关节痛", "皮疹"],
    redFlags: ["高热伴意识障碍", "皮下出血点"],
    physicalSigns: ["面色潮红", "呼吸/脉搏增快", "淋巴结肿大", "肝脾肿大", "皮疹"]
  },
  "头痛": {
      questions: [
        "头痛部位（单侧/双侧/全头）？",
        "性质（搏动性/胀痛/紧箍感）？",
        "程度与频率（发作周期/持续时间）？",
        "是否伴恶心、呕吐或畏光畏声（偏头痛特征）？",
        "有无先兆（视觉/感觉异常）？"
      ],
      relatedSymptoms: ["呕吐", "眩晕", "视力障碍"],
      redFlags: ["突发剧烈头痛（雷击样）", "伴有颈项强直", "伴有意识障碍或痫性发作"],
      physicalSigns: ["颈项强直", "Kernig征/Brudzinski征", "瞳孔大小与对光反射", "病理反射", "眼底检查"]
  },
  "腹泻": {
    questions: [
      "每日大便次数与量？",
      "粪便性状（水样/黏液脓血/油脂）？",
      "是否伴腹痛、发热或里急后重？",
      "与饮食不洁/抗生素使用的关系？",
      "是否有脱水表现（口渴、少尿、皮肤弹性差）？"
    ],
    relatedSymptoms: ["腹痛", "发热", "恶心与呕吐", "里急后重"],
    redFlags: ["高热伴血性腹泻或休克体征", "重度脱水（少尿/嗜睡）", "免疫缺陷人群持续腹泻>48小时伴发热"],
    physicalSigns: ["皮肤弹性", "腹部压痛", "肠鸣音活跃", "肛门指检（直肠病变）"]
  },
  "胸痛": {
    questions: [
      "部位（胸骨后/左胸/弥漫）？",
      "性质（压榨样/刺痛/撕裂样/灼痛）？",
      "是否放射至左臂/肩背/下颌？",
      "与活动/体位/呼吸的关系？",
      "持续时间与发作规律（突发突止/持续）？",
      "缓解因素（休息/硝酸酯）？"
    ],
    relatedSymptoms: ["呼吸困难", "心悸", "咳嗽", "咯血", "出汗"],
    redFlags: [">20分钟压榨样胸痛伴出汗/恶心", "突发撕裂样胸痛向背部放射", "伴晕厥/低血压/呼吸困难"],
    physicalSigns: ["心率/心律", "心脏杂音/心包摩擦音", "肺部啰音", "胸膜摩擦音", "胸壁压痛"]
  },
  "咳嗽": {
    questions: [
      "干咳还是咳痰？",
      "是否伴发热、胸痛或呼吸困难？",
      "夜间或运动后是否加重？",
      "吸烟史/职业粉尘或化学品暴露史？",
      "痰色（黄绿/铁锈色/血痰）与量？"
    ],
    relatedSymptoms: ["发热", "咳痰", "咯血", "胸痛", "呼吸困难"],
    redFlags: ["咯血或进行性呼吸困难", "高热伴意识改变", "体重明显下降或>8周久咳"],
    physicalSigns: ["呼吸音改变", "肺部干/湿啰音", "杵状指", "发绀", "气管位置"]
  },
  "呼吸困难": {
    questions: [
      "起病缓急（突发/渐进）与程度分级？",
      "病因分型（肺源性/心源性/中毒性/血源性/神经精神性）？",
      "与体位的关系（端坐呼吸/夜间阵发性呼吸困难）？",
      "伴喘鸣/咳嗽/胸痛？",
      "活动耐受度的变化？"
    ],
    relatedSymptoms: ["胸痛", "咳嗽", "心悸", "水肿"],
    redFlags: ["静息时呼吸困难/血氧下降", "青紫或意识障碍", "胸痛伴低血压或心悸"],
    physicalSigns: ["端坐呼吸体位", "三凹征", "发绀", "桶状胸", "颈静脉怒张", "双肺啰音/哮鸣音", "心界扩大/杂音"]
  },
  "咯血": {
    questions: [
      "出血量分级（痰中带血/小量<100ml/中等量100-500ml/大量>500ml）？",
      "出血颜色（鲜红/暗红）？",
      "是否伴胸痛、咳嗽或发热？",
      "有无肺部或心脏疾病史？"
    ],
    relatedSymptoms: ["胸痛", "咳嗽", "呼吸困难", "发热"],
    redFlags: ["大量咯血伴窒息", "咯血伴休克体征", "进行性呼吸困难"],
    physicalSigns: ["肺部固定湿啰音", "心脏二尖瓣面容/杂音", "杵状指", "贫血貌", "休克体征"]
  },
  "恶心与呕吐": {
    questions: [
      "频率与量，是否喷射性？",
      "呕吐物性状（胆汁/咖啡色/血）？",
      "与进食的关系？",
      "是否伴腹痛、发热或腹泻？",
      "是否有脱水或电解质紊乱表现？"
    ],
    relatedSymptoms: ["腹痛", "发热", "腹泻", "头痛"],
    redFlags: ["咖啡样或鲜血呕吐", "重度脱水/电解质紊乱", "剧烈头痛伴呕吐警惕颅内压升高"],
    physicalSigns: ["皮肤弹性/眼窝凹陷（脱水）", "腹部体征（压痛/包块）", "神经系统体征（脑膜刺激征/视乳头水肿）"]
  },
  "恶心呕吐": {
    questions: [
      "频率与量，是否喷射性？",
      "呕吐物性状（胆汁/咖啡色/血）？",
      "与进食的关系？",
      "是否伴腹痛、发热或腹泻？",
      "是否有脱水或电解质紊乱表现？"
    ],
    relatedSymptoms: ["腹痛", "发热", "腹泻", "头痛"],
    redFlags: ["咖啡样或鲜血呕吐", "重度脱水/电解质紊乱", "剧烈头痛伴呕吐警惕颅内压升高"],
    physicalSigns: ["皮肤弹性/眼窝凹陷（脱水）", "腹部体征（压痛/包块）", "神经系统体征（脑膜刺激征/视乳头水肿）"]
  },
  "上消化道出血": {
    questions: [
      "出血表现（呕血/黑便/隐血阳性）？",
      "出血量估计？",
      "是否伴有腹痛、反酸、烧心？",
      "有无肝病或服用NSAIDs药物史？"
    ],
    relatedSymptoms: ["腹痛", "恶心呕吐", "头晕", "乏力"],
    redFlags: ["持续呕血或黑便", "休克体征（心率快/血压低）", "意识淡漠"],
    physicalSigns: ["贫血貌", "肠鸣音活跃", "腹部压痛", "肝脾肿大/腹水/蜘蛛痣/肝掌（肝硬化）"]
  },
  "眩晕": {
    questions: [
      "眩晕类型（真性眩晕/头重脚轻）？",
      "病变部位分型（前庭系统性/非前庭系统性）？",
      "发作持续时间与频率？",
      "是否伴耳鸣、听力下降（梅尼埃病）？",
      "与体位变化的关系（位置性眩晕）？"
    ],
    relatedSymptoms: ["耳鸣", "恶心呕吐", "眼球震颤", "平衡障碍"],
    redFlags: ["伴有其他神经系统体征（复视/构音障碍/肢体麻木）", "持续性剧烈眩晕", "高龄伴高血压/糖尿病"],
    physicalSigns: ["眼球震颤（水平/垂直/旋转）", "共济失调（指鼻试验）", "Romberg征", "听力检查", "外耳道检查"]
  },
  "心悸": {
    questions: [
      "性质（阵发/持续）、频率与节律？",
      "诱因（活动、情绪、咖啡因）？",
      "发作时心率与节律是否规则？",
      "是否伴胸痛或呼吸困难？",
      "是否有晕厥或近晕厥？"
    ],
    relatedSymptoms: ["胸痛", "呼吸困难", "乏力", "晕厥"],
    redFlags: ["晕厥或近晕厥", "心动过速>150次/分伴低血压", "家族猝死史或QT延长史"],
    physicalSigns: ["心率", "心律（整齐/不齐）", "心脏杂音", "甲状腺肿大", "贫血貌"]
  },
  "乏力": {
    questions: [
      "起病时间与进展速度？",
      "程度与日常功能影响？",
      "是否伴头晕、体重变化或发热？",
      "是否有慢性病/药物使用史？"
    ],
    relatedSymptoms: ["发热", "体重下降", "头晕", "食欲下降"],
    redFlags: ["进行性加重伴黄疸或出血点", "明显贫血体征（心动过速/苍白）"],
    physicalSigns: ["贫血貌", "黄疸", "淋巴结肿大", "肝脾肿大", "肌力/肌张力"]
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

// 标准化症状术语库（来自主诉选项与现病史映射）
const STANDARD_SYMPTOMS = new Set<string>([
  "发热", "头痛", "咳嗽", "腹痛", "胸痛", "呼吸困难", "心悸", "恶心呕吐", "腹泻", "乏力",
  "咯血", "眩晕", "上消化道出血",
  ...Object.values(HPI_ASSOCIATED_MAP)
]);

// 症状同义词映射（归一化到标准术语）
const SYMPTOM_SYNONYMS: Record<string, string> = {
  "恶心与呕吐": "恶心呕吐",
  "呕吐伴恶心": "恶心呕吐",
  "恶心后呕吐": "恶心呕吐",
  "发烧": "发热",
  "体温升高": "发热",
  "高热": "发热",
  "眩晕": "眩晕", // 保持一致
  "头晕": "眩晕", // 广义头晕通常包含眩晕，这里简化映射
  "天旋地转": "眩晕",
  "痰中带血": "咯血",
  "吐血": "上消化道出血", // 呕血归类为上消化道出血
  "呕血": "上消化道出血",
  "黑色大便": "上消化道出血", // 黑便归类为上消化道出血
  "黑便": "上消化道出血",
  "柏油样便": "上消化道出血",
  "偏头痛": "头痛",
  "神经性头痛": "头痛"
};

const SYMPTOM_NAME_TO_KEY: Record<string, string> = {
  "腹痛": "abdominal_pain",
  "发热": "fever",
  "头痛": "headache",
  "腹泻": "diarrhea",
  "胸痛": "chest_pain",
  "咳嗽": "cough_and_expectoration",
  "呼吸困难": "dyspnea",
  "咯血": "hemoptysis",
  "恶心呕吐": "nausea_vomiting",
  "恶心与呕吐": "nausea_vomiting",
  "上消化道出血": "hematemesis",
  "眩晕": "vertigo",
  "心悸": "palpitation",
  "乏力": "fatigue",
  "意识障碍": "disturbance_of_consciousness",
  "晕厥": "syncope",
  "抽搐": "tic_convulsion",
  "水肿": "edema",
  "黄疸": "jaundice",
  "贫血": "anemia",
  "关节痛": "arthralgia",
  "腰背痛": "lumbodorsalgia",
  "尿频尿急尿痛": "urinary_frequency_urgency_dysuria",
  "血尿": "hematuria",
  "便秘": "constipation",
  "体重下降": "emaciation"
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

async function getKnowledgeByName(symptomName: string): Promise<KnowledgeItem | null> {
  const normalizedName = SYMPTOM_SYNONYMS[symptomName] || symptomName;
  const symptomKey = SYMPTOM_NAME_TO_KEY[normalizedName] || normalizedName.toLowerCase().replace(/\s+/g, '_');
  
  const cached = knowledgeCache.get(symptomKey);
  if (cached) {
    const age = Date.now() - cached.fetchedAt;
    if (age < KNOWLEDGE_TTL_MS) {
      return cached.item;
    } else {
      console.log(`[Session] 缓存过期，触发重拉取: ${symptomKey}`);
      // 过期则直接刷新并返回最新数据（若失败则回退到缓存）
      const fresh = await fetchKnowledgeFromAPI(symptomKey);
      return fresh || cached.item;
    }
  }
  
  if (pendingRequests.has(symptomKey)) {
    return pendingRequests.get(symptomKey)!;
  }
  
  const request = fetchKnowledgeFromAPI(symptomKey);
  pendingRequests.set(symptomKey, request);
  
  const result = await request;
  pendingRequests.delete(symptomKey);
  
  return result;
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

const Session: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
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
      if (ccSymptom) {
        const negPatterns = [`否认${ccSymptom}`, `无${ccSymptom}`, `不伴${ccSymptom}`, `未见${ccSymptom}`];
        const isNeg = negPatterns.some(p => ccText.includes(p));
        const normalized = SYMPTOM_SYNONYMS[ccSymptom.trim()] || ccSymptom.trim();
        if (!isNeg && (STANDARD_SYMPTOMS.has(normalized) || STANDARD_SYMPTOMS.has(ccSymptom.trim()))) {
          activeSymptoms.push(normalized);
        }
      }
      if (hpiAssociated && hpiAssociated.length > 0) {
        for (const k of hpiAssociated) {
          const mapped = HPI_ASSOCIATED_MAP[k];
          const normalized = mapped ? (SYMPTOM_SYNONYMS[mapped] || mapped) : undefined;
          if (normalized && STANDARD_SYMPTOMS.has(normalized)) {
            activeSymptoms.push(normalized);
          }
        }
      }
      if (pastHistoryConfirmed && pastHistoryConfirmed.length > 0) {
        for (const s of pastHistoryConfirmed) {
          const name = String(s).trim();
          const normalized = SYMPTOM_SYNONYMS[name] || name;
          if (normalized && STANDARD_SYMPTOMS.has(normalized)) {
            activeSymptoms.push(normalized);
          }
        }
      }
      return Array.from(new Set(activeSymptoms));
  }, [chiefComplaintValues, hpiAssociated, pastHistoryConfirmed]);

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

    for (const s of symptoms) {
      const knowledge = await getKnowledgeByName(s);
      if (knowledge) {
        for (const q of knowledge.requiredQuestions || []) questionsSet.add(q);
        for (const r of knowledge.associatedSymptoms || []) relatedSet.add(r);
        for (const f of knowledge.redFlags || []) redFlagsSet.add(f);
        if (knowledge.physicalSigns) {
          for (const p of knowledge.physicalSigns) physicalSignsSet.add(p);
        }
      } else {
        const prompt = symptomPrompts[s];
        if (prompt) {
          for (const q of prompt.questions) questionsSet.add(q);
          for (const r of prompt.relatedSymptoms) relatedSet.add(r);
          for (const f of prompt.redFlags) redFlagsSet.add(f);
          if (prompt.physicalSigns) {
            for (const p of prompt.physicalSigns) physicalSignsSet.add(p);
          }
        } else {
          questionsSet.add("症状的起因？");
          questionsSet.add("持续时间？");
          questionsSet.add("加重/缓解因素？");
        }
      }
    }

    setSymptomContext({
      name,
      questions: Array.from(questionsSet),
      relatedSymptoms: Array.from(relatedSet),
      redFlags: Array.from(redFlagsSet),
      physicalSigns: Array.from(physicalSignsSet)
    });
    setKnowledgeLoading(false);
  }, []);

  useEffect(() => {
    const active = pickActiveSymptoms();
    if (active.length > 0) {
      console.log('[Session] 已识别有效症状', active);
      updateSymptomContext(active);
    } else {
      console.log('[Session] 未识别到有效症状或为否认/无症状表达');
      setSymptomContext(null);
      setKnowledgeLoading(false);
    }
  }, [pickActiveSymptoms, updateSymptomContext]);

  const allValues = Form.useWatch([], form);

  useEffect(() => {
    if (!allValues) return;
    const val = allValues as any;

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
          const hpi = val.presentIllness || {};
          const hasOnset = !!(hpi.onsetMode || hpi.onsetTime || hpi.trigger);
          const hasSymptom = !!(hpi.location || (hpi.quality && hpi.quality.length > 0) || hpi.severity || hpi.durationDetails || hpi.factors);
          const hasTreatment = !!hpi.treatmentHistory;
          isCompleted = (hasOnset && hasSymptom) || hasTreatment;
          break;
        case 'past_history':
          const ph = val.pastHistory || {};
          const hasDisease = ph.pmh_diseases?.length > 0;
          const hasSurgery = !!ph.pmh_trauma_surgery;
          const hasAllergy = !!(ph.pmh_allergies || ph.hasAllergy === 'yes');
          const hasInfectious = !!ph.pmh_infectious;
          const hasOther = !!ph.pmh_other;
          isCompleted = hasDisease || hasSurgery || hasAllergy || hasInfectious || hasOther;
          break;
        case 'personal_history':
          const per = val.personalHistory || {};
          isCompleted = !!(per.smoking_status && per.alcohol_status);
          break;
        case 'marital_history':
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
        case 'family_history':
          const fam = val.familyHistory || {};
          isCompleted = !!(fam.father || fam.mother || fam.genetic_diseases?.length > 0 || fam.deceased || fam.other);
          break;
        case 'review_of_systems':
          const ros = val.reviewOfSystems || {};
          const systems = ['respiratory', 'cardiovascular', 'digestive', 'urinary', 'hematologic', 'endocrine', 'neurological', 'musculoskeletal'];
          isCompleted = systems.some((sys: string) => {
            const sysData = ros[sys] || {};
            return (sysData.symptoms?.length > 0) || !!sysData.details;
          });
          break;
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
      // Check if it's a validation error
      if ((error as any).errorFields) {
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
              loading={loading}
            />
        </Spin>
      }
      knowledge={
        <KnowledgePanel
          activeSection={currentSection}
          loading={knowledgeLoading}
          symptomContext={symptomContext || undefined}
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
