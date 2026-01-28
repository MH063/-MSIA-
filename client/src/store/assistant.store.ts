import { create } from 'zustand';

export type ModuleKey = 'general' | 'chief_complaint' | 'hpi' | 'past_history' | 'personal_history' | 'marital_history' | 'family_history' | 'review_of_systems';

export interface PanelRecognition {
  symptom?: string;
  duration?: string;
}

export interface PanelTimelineEntry {
  label: string;
  done: boolean;
}

export interface AssistantPanelData {
  pendingItems?: string[];
  tips?: string[];
  validationText?: string;
  sampleInput?: string;
  recognition?: PanelRecognition;
  normative?: { good?: string; bad?: string };
  diseases?: string[];
  timeline?: PanelTimelineEntry[];
  guidance?: string[];
  omissions?: string[];
  actions?: string[];
  smokingIndexHint?: string;
  drinkingHint?: string;
  weeklyAlcoholHint?: string;
  hpiCareValidationTip?: string;
  maritalValidation?: string;
  familySummary?: string;
  geneticRiskTip?: string;
  occupationalExposureTip?: string;
  pregnancyRedFlagsTip?: string;
  conflictTip?: string;
  redFlagsTip?: string;
}

export interface AssistantActions {
  improveChiefComplaint?: () => void;
  openExampleLibrary?: () => void;
  openDetailHelp?: () => void;
  startVoiceInput?: () => void;
  editTimeline?: () => void;
  recommendSymptoms?: () => void;
  checkHpiCompleteness?: () => void;
  completePastHistory?: () => void;
  guideReviewOfSystems?: () => void;
  remindRedFlags?: () => void;
  showPersonalHints?: () => void;
  validateMaritalHistory?: () => void;
  summarizeFamilyHistory?: () => void;
  assessGeneticRisk?: () => void;
  suggestOccupationalExposure?: () => void;
  showPregnancyRedFlags?: () => void;
  detectFamilyConflict?: () => void;
}

export interface AssistantState {
  moduleKey: ModuleKey;
  moduleLabel: string;
  progressPercent: number;
  panel: AssistantPanelData;
  hasNewMessage: boolean;
  actions: AssistantActions;
  setModule: (key: ModuleKey, label: string) => void;
  setProgress: (p: number) => void;
  setPanel: (data: Partial<AssistantPanelData>) => void;
  setNewMessage: (flag: boolean) => void;
  setActions: (handlers: Partial<AssistantActions>) => void;
}

/**
 * useAssistantStore
 * 智能助手全局状态存储：模块上下文、进度与迷你面板内容
 */
export const useAssistantStore = create<AssistantState>((set) => ({
  moduleKey: 'general',
  moduleLabel: '一般项目',
  progressPercent: 0,
  panel: {},
  hasNewMessage: false,
  actions: {},
  /**
   * setModule
   * 设置当前模块键与展示标签
   */
  setModule: (key, label) => set({ moduleKey: key, moduleLabel: label }),
  /**
   * setProgress
   * 设置完成进度百分比（0-100）
   */
  setProgress: (p) => set({ progressPercent: Math.max(0, Math.min(100, Math.round(p))) }),
  /**
   * setPanel
   * 合并更新迷你面板数据
   */
  setPanel: (data) => set((s) => ({ panel: { ...s.panel, ...data } })),
  /**
   * setNewMessage
   * 设置是否有新的助手消息（用于按钮状态提醒）
   */
  setNewMessage: (flag) => set({ hasNewMessage: flag }),
  /**
   * setActions
   * 设定或更新各功能按钮的处理函数
   */
  setActions: (handlers) => set((s) => ({ actions: { ...s.actions, ...handlers } })),
}));

