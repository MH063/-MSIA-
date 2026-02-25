import { Request, Response } from 'express';
import { secureLogger } from '../utils/secureLogger';
import prisma from '../prisma';

/**
 * 获取诊断建议
 */
export const suggestDiagnosis = async (req: Request, res: Response) => {
  try {
    const { symptoms } = req.body;
    
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      res.status(400).json({ success: false, message: '症状列表不能为空' });
      return;
    }

    // 基于症状查询可能的诊断
    const possibleDiagnoses = await findDiagnosesBySymptoms(symptoms);
    
    res.json({
      success: true,
      data: {
        suggestions: possibleDiagnoses,
        confidence: calculateConfidence(symptoms, possibleDiagnoses)
      }
    });
  } catch (error) {
    secureLogger.error('[DiagnosisController] 获取诊断建议失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: '获取诊断建议失败' });
  }
};

/**
 * 获取增强版诊断建议
 */
export const suggestEnhancedDiagnosis = async (req: Request, res: Response) => {
  try {
    const { symptoms, patientInfo, history } = req.body;
    
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      res.status(400).json({ success: false, message: '症状列表不能为空' });
      return;
    }

    // 基于症状和患者信息查询可能的诊断
    const possibleDiagnoses = await findDiagnosesBySymptoms(symptoms);
    
    // 根据患者信息调整诊断建议
    const adjustedDiagnoses = adjustDiagnosesByPatientInfo(possibleDiagnoses, patientInfo, history);
    
    res.json({
      success: true,
      data: {
        suggestions: adjustedDiagnoses,
        confidence: calculateConfidence(symptoms, adjustedDiagnoses),
        reasoning: generateReasoning(symptoms, patientInfo, adjustedDiagnoses)
      }
    });
  } catch (error) {
    secureLogger.error('[DiagnosisController] 获取增强诊断建议失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: '获取增强诊断建议失败' });
  }
};

/**
 * 获取所有诊断列表
 */
export const getAllDiagnoses = async (_req: Request, res: Response) => {
  try {
    const diagnoses = await prisma.diagnosis.findMany({
      orderBy: { name: 'asc' }
    });
    
    res.json({ success: true, data: diagnoses });
  } catch (error) {
    secureLogger.error('[DiagnosisController] 获取诊断列表失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: '获取诊断列表失败' });
  }
};

/**
 * 根据ID获取诊断详情
 */
export const getDiagnosisById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    
    const diagnosis = await prisma.diagnosis.findUnique({
      where: { id }
    });
    
    if (!diagnosis) {
      res.status(404).json({ success: false, message: '诊断未找到' });
      return;
    }
    
    res.json({ success: true, data: diagnosis });
  } catch (error) {
    secureLogger.error('[DiagnosisController] 获取诊断详情失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: '获取诊断详情失败' });
  }
};

/**
 * 初始化诊断数据
 */
export const initializeDiagnosisData = async (_req: Request, res: Response) => {
  try {
    // 检查是否已有数据
    const count = await prisma.diagnosis.count();
    if (count > 0) {
      res.json({ success: true, message: '诊断数据已存在，无需初始化' });
      return;
    }

    // 初始化常见诊断数据
    const commonDiagnoses = [
      { name: '上呼吸道感染', category: '呼吸系统' },
      { name: '急性支气管炎', category: '呼吸系统' },
      { name: '肺炎', category: '呼吸系统' },
      { name: '急性胃肠炎', category: '消化系统' },
      { name: '高血压', category: '心血管系统' },
      { name: '冠心病', category: '心血管系统' },
    ];

    for (const diagnosis of commonDiagnoses) {
      await prisma.diagnosis.create({
        data: {
          name: diagnosis.name,
          category: diagnosis.category
        }
      });
    }
    
    res.json({ success: true, message: '诊断数据初始化成功' });
  } catch (error) {
    secureLogger.error('[DiagnosisController] 初始化诊断数据失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: '初始化诊断数据失败' });
  }
};

// 辅助函数：根据症状查找可能的诊断
async function findDiagnosesBySymptoms(symptoms: string[]) {
  try {
    const allDiagnoses = await prisma.diagnosis.findMany({
      include: {
        symptoms: true
      }
    });
    
    // 计算每个诊断与症状的匹配度
    const scoredDiagnoses = allDiagnoses.map(diagnosis => {
      const diagnosisSymptomKeys = diagnosis.symptoms.map(s => s.symptomKey);
      const matchedSymptoms = symptoms.filter(s => 
        diagnosisSymptomKeys.some(ds => ds.includes(s) || s.includes(ds))
      );
      const score = matchedSymptoms.length / Math.max(symptoms.length, diagnosisSymptomKeys.length || 1);
      
      return {
        ...diagnosis,
        matchedSymptoms,
        score
      };
    });
    
    // 按匹配度排序，返回前5个
    return scoredDiagnoses
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch (error) {
    secureLogger.error('[DiagnosisController] 查找诊断失败', error instanceof Error ? error : undefined);
    return [];
  }
}

/**
 * 患者信息接口
 */
interface PatientInfo {
  age?: number;
  gender?: string;
  [key: string]: unknown;
}

/**
 * 病史信息接口
 */
interface HistoryInfo {
  chronicDiseases?: string[];
  [key: string]: unknown;
}

/**
 * 诊断结果接口
 */
interface DiagnosisResult {
  id: number;
  name: string;
  category?: string | null;
  description?: string | null;
  score: number;
  matchedSymptoms: string[];
  adjustedScore?: number;
}

// 辅助函数：根据患者信息调整诊断建议
function adjustDiagnosesByPatientInfo(
  diagnoses: DiagnosisResult[],
  patientInfo?: PatientInfo,
  history?: HistoryInfo
): DiagnosisResult[] {
  if (!patientInfo && !history) {return diagnoses;}

  return diagnoses.map(diagnosis => {
    let adjustedScore = diagnosis.score;

    // 根据年龄调整
    if (patientInfo?.age) {
      if (patientInfo.age > 60 && diagnosis.category === '心血管系统') {
        adjustedScore *= 1.2;
      }
    }

    // 根据病史调整
    if (history?.chronicDiseases) {
      const chronicDiseases = history.chronicDiseases;
      if (chronicDiseases.some((d: string) => diagnosis.name.includes(d))) {
        adjustedScore *= 1.3;
      }
    }

    return {
      ...diagnosis,
      adjustedScore
    };
  }).sort((a, b) => (b.adjustedScore || b.score) - (a.adjustedScore || a.score));
}

// 辅助函数：计算置信度
function calculateConfidence(symptoms: string[], diagnoses: DiagnosisResult[]): number {
  if (diagnoses.length === 0) {return 0;}

  const topScore = diagnoses[0]?.score || 0;
  const symptomCoverage = (diagnoses[0]?.matchedSymptoms?.length || 0) / symptoms.length || 0;

  return Math.min(Math.round((topScore * 0.6 + symptomCoverage * 0.4) * 100), 95);
}

// 辅助函数：生成推理说明
function generateReasoning(symptoms: string[], patientInfo: PatientInfo | undefined, diagnoses: DiagnosisResult[]): string {
  if (diagnoses.length === 0) {
    return '根据当前症状无法确定明确诊断，建议进一步检查。';
  }

  const topDiagnosis = diagnoses[0];
  const matchedSymptoms = topDiagnosis.matchedSymptoms || [];

  let reasoning = `主要考虑${topDiagnosis.name}，因为患者表现出${matchedSymptoms.join('、')}等症状`;

  if (patientInfo?.age && patientInfo.age > 60) {
    reasoning += '，且患者年龄较大，需要警惕';
  }

  if (diagnoses.length > 1) {
    reasoning += `。同时需要鉴别${diagnoses[1].name}。`;
  }

  return reasoning;
}
