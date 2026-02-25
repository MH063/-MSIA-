/**
 * 全局类型定义
 * 统一管理系统中使用的类型
 */

/**
 * API响应标准格式
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API错误格式
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
  stack?: string;
}

/**
 * 响应元数据
 */
export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  pagination?: PaginationInfo;
}

/**
 * 分页信息
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * 患者类型
 */
export interface Patient {
  id: number;
  name: string;
  gender: 'male' | 'female' | 'other';
  birthDate?: Date | string;
  age?: number;
  ethnicity?: string;
  nativePlace?: string;
  placeOfBirth?: string;
  occupation?: string;
  employer?: string;
  address?: string;
  phone?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * 体格检查类型
 */
export interface PhysicalExam {
  general?: string;
  skin?: string;
  lymph?: string;
  head?: string;
  eyes?: string;
  ears?: string;
  nose?: string;
  throat?: string;
  neck?: string;
  chest?: string;
  heart?: string;
  lungs?: string;
  abdomen?: string;
  extremities?: string;
  nervousSystem?: string;
  other?: string;
  [key: string]: string | Record<string, unknown> | undefined;
}

/**
 * 月经史类型
 */
export interface MenstrualHistory {
  age?: number | string;
  duration?: number | string;
  cycle?: number | string;
  menopause_age?: number | string;
  lmp?: string;
  flow?: string;
  color?: string;
  pain?: string;
  [key: string]: unknown;
}

/**
 * 生育史类型
 */
export interface FertilityHistory {
  gravida?: number | string;
  para?: number | string;
  abortion_artificial?: number | string;
  abortion_natural?: number | string;
  stillbirth?: number | string;
  premature?: number | string;
  contraception?: string;
  [key: string]: unknown;
}

/**
 * 家族史类型
 */
export interface FamilyHistory {
  father_health?: string;
  mother_health?: string;
  siblings_health?: string;
  children_health?: string;
  genetic_disease?: string;
  similar_disease?: string;
  parents?: string;
  siblings?: string;
  children?: string;
  conditions?: string[];
  deceased?: string;
  other?: string;
  [key: string]: unknown;
}

/**
 * 婚姻史类型
 */
export interface MaritalHistory {
  status?: 'single' | 'married' | 'divorced' | 'widowed';
  marriage_age?: number;
  spouse_health?: string;
  children?: string;
  other?: string;
}

/**
 * 会话类型
 */
export interface Session {
  id: number;
  patientId: number;
  patient?: Patient;
  historian?: string;
  reliability?: 'reliable' | 'unreliable' | 'uncertain';
  historianRelationship?: string;
  chiefComplaint?: ChiefComplaint;
  presentIllness?: Record<string, unknown>;
  pastHistory?: Record<string, unknown>;
  personalHistory?: Record<string, unknown>;
  maritalHistory?: MaritalHistory;
  familyHistory?: FamilyHistory;
  reviewOfSystems?: Record<string, unknown>;
  physicalExam?: PhysicalExam;
  specialistExam?: Record<string, unknown>;
  auxiliaryExams?: Record<string, unknown>;
  menstrualHistory?: MenstrualHistory;
  fertilityHistory?: FertilityHistory;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * 主诉信息
 */
export interface ChiefComplaint {
  text?: string;
  symptom?: string;
  durationNum?: number;
  durationUnit?: 'hour' | 'day' | 'week' | 'month' | 'year';
}

/**
 * 诊断类型
 */
export interface Diagnosis {
  id: number;
  name: string;
  category: string;
  description?: string;
  symptoms: DiagnosisSymptom[];
  redFlags: DiagnosisRedFlag[];
  confidence?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * 诊断-症状关联
 */
export interface DiagnosisSymptom {
  id: number;
  diagnosisId: number;
  symptomKey: string;
  weight: number;
  isRequired: boolean;
}

/**
 * 诊断-警惕征象关联
 */
export interface DiagnosisRedFlag {
  id: number;
  diagnosisId: number;
  redFlagName: string;
  weight: number;
  severityLevel: number;
}

/**
 * 症状知识类型
 */
export interface SymptomKnowledge {
  id: number;
  symptomKey: string;
  displayName: string;
  requiredQuestions: string[];
  associatedSymptoms?: string[];
  redFlags?: string[];
  physicalSigns?: string[];
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  version: number;
  isLatest: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * 诊断建议请求
 */
export interface DiagnosisSuggestRequest {
  sessionId: number;
  symptoms: string[];
  gender?: 'male' | 'female' | 'other';
  age?: number;
}

/**
 * 增强诊断建议请求
 */
export interface EnhancedDiagnosisRequest {
  sessionId: number;
  currentSymptom: string;
  associatedSymptoms: string[];
  redFlags: string[];
  age?: number;
  gender?: 'male' | 'female' | 'other';
}

/**
 * 诊断建议结果
 */
export interface DiagnosisSuggestion {
  id: number;
  name: string;
  category: string;
  confidence: number;
  matchedSymptoms: string[];
  matchedRedFlags: string[];
  recommendations: string[];
}

/**
 * 查询过滤器
 */
export interface QueryFilter {
  search?: string;
  category?: string;
  priority?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

/**
 * 排序参数
 */
export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * 环境类型
 */
export type Environment = 'development' | 'test' | 'production';

/**
 * HTTP方法
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
