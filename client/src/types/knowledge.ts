/**
 * 知识库相关类型定义
 */

/**
 * 症状红旗征类型
 */
export interface RedFlag {
  name: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high';
}

/**
 * 伴随症状类型
 */
export interface AssociatedSymptom {
  name: string;
  frequency?: string;
  notes?: string;
}

/**
 * 问诊问题类型
 */
export interface QuestionItem {
  question: string;
  type?: 'open' | 'closed' | 'multiple';
  options?: string[];
  required?: boolean;
}

/**
 * 服务器返回的症状映射类型
 */
export interface ServerSymptomMapping {
  symptomKey: string;
  displayName: string;
  category?: string | null;
  description?: string | null;
  redFlags?: RedFlag[] | string[];
  associatedSymptoms?: AssociatedSymptom[] | string[];
  questions?: QuestionItem[] | string[];
  physicalSigns?: string[];
  commonCauses?: string[];
  onsetPatterns?: string[];
  severityScale?: Array<{ level: string; description: string }>;
  relatedExams?: string[];
  bodySystems?: string[];
  ageGroups?: string[];
  prevalence?: string;
}

/**
 * 前端使用的知识项类型
 */
export interface KnowledgeItem {
  id: string;
  symptomKey: string;
  symptomName: string;
  category?: string;
  description?: string;
  redFlags: string[];
  relatedSymptoms: string[];
  questions: string[];
  physicalSigns?: string[];
  commonCauses?: string[];
  relatedExams?: string[];
}

/**
 * 症状映射搜索结果类型
 */
export interface SymptomMatch {
  name: string;
  key: string;
}

/**
 * 会话搜索项类型
 */
export interface SessionSearchItem {
  id: number;
  patient?: {
    name?: string;
    gender?: string;
  };
  createdAt: string;
  status: string;
}

/**
 * 会话搜索响应类型
 */
export interface SessionSearchPayload {
  items: SessionSearchItem[];
  total: number;
}

/**
 * 症状映射响应类型
 */
export interface SymptomMappingPayload {
  nameToKey: Record<string, string>;
  synonyms: Record<string, string>;
}

/**
 * 知识图谱节点类型
 */
export interface GraphNode {
  id: string;
  name: string;
  category: number;
  symbolSize: number;
}

/**
 * 知识图谱链接类型
 */
export interface GraphLink {
  source: string;
  target: string;
}

/**
 * 知识图谱分类类型
 */
export interface GraphCategory {
  name: string;
}

/**
 * 知识图谱数据类型
 */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  categories: GraphCategory[];
}

/**
 * 树节点类型
 */
export interface TreeNode {
  title: React.ReactNode;
  key: string;
  icon?: React.ReactNode;
  children?: TreeNode[];
}

/**
 * 解析服务器返回的红旗征数据
 */
export function parseRedFlags(data: unknown): string[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null && 'name' in item) {
        return String((item as { name: string }).name);
      }
      return String(item);
    });
  }
  return [];
}

/**
 * 解析服务器返回的伴随症状数据
 */
export function parseAssociatedSymptoms(data: unknown): string[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null && 'name' in item) {
        return String((item as { name: string }).name);
      }
      return String(item);
    });
  }
  return [];
}

/**
 * 解析服务器返回的问题数据
 */
export function parseQuestions(data: unknown): string[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null && 'question' in item) {
        return String((item as { question: string }).question);
      }
      return String(item);
    });
  }
  return [];
}

/**
 * 将服务器数据转换为前端知识项
 */
export function toKnowledgeItem(serverData: ServerSymptomMapping): KnowledgeItem {
  return {
    id: serverData.symptomKey,
    symptomKey: serverData.symptomKey,
    symptomName: serverData.displayName || serverData.symptomKey,
    category: serverData.category || '常见症状',
    description: typeof serverData.description === 'string' ? serverData.description : undefined,
    redFlags: parseRedFlags(serverData.redFlags),
    relatedSymptoms: parseAssociatedSymptoms(serverData.associatedSymptoms),
    questions: parseQuestions(serverData.questions),
    physicalSigns: Array.isArray(serverData.physicalSigns) 
      ? serverData.physicalSigns.map(String) 
      : [],
    commonCauses: Array.isArray(serverData.commonCauses) 
      ? serverData.commonCauses.map(String) 
      : [],
    relatedExams: Array.isArray(serverData.relatedExams) 
      ? serverData.relatedExams.map(String) 
      : [],
  };
}
