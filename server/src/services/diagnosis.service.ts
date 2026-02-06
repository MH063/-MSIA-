import prisma from '../prisma';

/**
 * 诊断置信度计算参数
 */
interface ConfidenceParams {
  diagnosisId: number;
  matchedSymptoms: number;
  totalSymptoms: number;
  matchedRedFlags: number;
  patientAge?: number;
  patientGender?: string;
}

/**
 * 诊断建议结果
 */
interface DiagnosisSuggestion {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  confidence: number;
  supportingSymptoms: string[];
  excludingSymptoms: string[];
  missingSymptoms: string[];
  redFlags: string[];
  recommendation: string;
}

/**
 * 症状关联数据
 */
interface SymptomAssociation {
  symptom: string;
  associatedSymptoms: string[];
  relatedDiagnoses: string[];
  strength: number;
}

/**
 * 从数据库获取所有活跃诊断及其关联数据
 */
export const getAllDiagnosesWithRelations = async () => {
  return await prisma.diagnosis.findMany({
    where: { isActive: true },
    include: {
      symptoms: true,
      redFlags: true,
    },
    orderBy: { priority: 'desc' },
  });
};

/**
 * 根据症状关键词获取相关诊断
 */
export const getDiagnosesBySymptoms = async (symptomKeys: string[]) => {
  if (symptomKeys.length === 0) {return [];}

  return await prisma.diagnosis.findMany({
    where: {
      isActive: true,
      symptoms: {
        some: {
          symptomKey: { in: symptomKeys },
          isExcluding: false,
        },
      },
    },
    include: {
      symptoms: true,
      redFlags: true,
    },
  });
};

/**
 * 计算诊断置信度
 * @param params 置信度计算参数
 * @returns 置信度分数 (0-1)
 */
export const calculateConfidence = (params: ConfidenceParams): number => {
  const {
    matchedSymptoms,
    totalSymptoms,
    matchedRedFlags,
    patientAge,
    patientGender,
  } = params;

  // 基础置信度
  let confidence = 0.5;

  // 症状匹配度计算 - 匹配的症状越多，置信度越高
  if (totalSymptoms > 0) {
    const symptomRatio = matchedSymptoms / totalSymptoms;
    confidence += symptomRatio * 0.3;
  }

  // 警惕征象影响 - 每个匹配的警惕征象增加置信度
  confidence += matchedRedFlags * 0.1;

  // 年龄因素验证（如果提供了年龄）
  if (patientAge !== undefined) {
    // 这里可以添加更复杂的年龄匹配逻辑
    // 暂时保持基础计算
  }

  // 性别因素验证（如果提供了性别）
  if (patientGender) {
    // 这里可以添加性别匹配逻辑
  }

  // 确保置信度在合理范围内
  return Math.min(Math.max(confidence, 0), 0.95);
};

/**
 * 生成诊断建议
 * @param sessionId 会话ID
 * @param currentSymptom 当前主要症状
 * @param associatedSymptoms 伴随症状列表
 * @param redFlags 警惕征象列表
 * @param patientAge 患者年龄
 * @param patientGender 患者性别
 * @returns 诊断建议列表和症状关联数据
 */
export const generateDiagnosisSuggestions = async (
  sessionId: number,
  currentSymptom: string,
  associatedSymptoms: string[] = [],
  redFlags: string[] = [],
  patientAge?: number,
  patientGender?: string
): Promise<{
  diagnoses: DiagnosisSuggestion[];
  symptomAssociations: SymptomAssociation[];
}> => {
  // 合并所有症状
  const allSymptoms = [currentSymptom, ...associatedSymptoms].filter(Boolean);

  if (allSymptoms.length === 0) {
    return { diagnoses: [], symptomAssociations: [] };
  }

  // 从数据库获取相关诊断
  const diagnoses = await getDiagnosesBySymptoms(allSymptoms);

  // 计算每个诊断的置信度
  const suggestions: DiagnosisSuggestion[] = diagnoses.map((diagnosis) => {
    // 获取该诊断关联的所有症状key
    const diagnosisSymptomKeys = diagnosis.symptoms
      .filter((s) => !s.isExcluding)
      .map((s) => s.symptomKey);

    // 计算匹配的症状
    const matchedSymptoms = allSymptoms.filter((s) =>
      diagnosisSymptomKeys.includes(s)
    );

    // 计算排除症状（有此症状应降低该诊断可能性）
    const excludingSymptoms = diagnosis.symptoms
      .filter((s) => s.isExcluding)
      .map((s) => s.symptomKey);
    const matchedExcluding = allSymptoms.filter((s) =>
      excludingSymptoms.includes(s)
    );

    // 计算缺失的症状（该诊断应有但未提供的症状）
    const missingSymptoms = diagnosisSymptomKeys.filter(
      (s) => !allSymptoms.includes(s)
    );

    // 计算匹配的警惕征象
    const matchedRedFlags = diagnosis.redFlags.filter((rf) =>
      redFlags.includes(rf.redFlagName)
    );

    // 计算置信度
    let confidence = calculateConfidence({
      diagnosisId: diagnosis.id,
      matchedSymptoms: matchedSymptoms.length,
      totalSymptoms: diagnosisSymptomKeys.length,
      matchedRedFlags: matchedRedFlags.length,
      patientAge,
      patientGender,
    });

    // 如果有排除症状，降低置信度
    if (matchedExcluding.length > 0) {
      confidence -= matchedExcluding.length * 0.15;
    }

    // 确保置信度在合理范围
    confidence = Math.max(0.1, Math.min(0.95, confidence));

    // 生成推荐建议
    let recommendation: string;
    if (confidence > 0.7) {
      recommendation = '高度怀疑，建议进一步检查确认';
    } else if (confidence > 0.4) {
      recommendation = '可能性存在，需结合其他检查';
    } else {
      recommendation = '证据不足，需继续观察或排除其他诊断';
    }

    return {
      id: diagnosis.id,
      name: diagnosis.name,
      description: diagnosis.description,
      category: diagnosis.category,
      confidence,
      supportingSymptoms: matchedSymptoms,
      excludingSymptoms: matchedExcluding,
      missingSymptoms,
      redFlags: matchedRedFlags.map((rf) => rf.redFlagName),
      recommendation,
    };
  });

  // 按置信度排序
  suggestions.sort((a, b) => b.confidence - a.confidence);

  // 生成症状关联数据
  const symptomAssociations: SymptomAssociation[] = allSymptoms.map(
    (symptom) => {
      // 找到包含此症状的所有诊断
      const relatedDiagnoses = diagnoses.filter((d) =>
        d.symptoms.some((s) => s.symptomKey === symptom && !s.isExcluding)
      );

      // 收集相关症状
      const relatedSymptoms = new Set<string>();
      relatedDiagnoses.forEach((d) => {
        d.symptoms.forEach((s) => {
          if (s.symptomKey !== symptom && !s.isExcluding) {
            relatedSymptoms.add(s.symptomKey);
          }
        });
      });

      // 计算关联强度
      const strength = Math.min(relatedDiagnoses.length * 0.15 + 0.3, 0.9);

      return {
        symptom,
        associatedSymptoms: Array.from(relatedSymptoms).slice(0, 5),
        relatedDiagnoses: relatedDiagnoses.map((d) => d.name).slice(0, 3),
        strength,
      };
    }
  );

  return {
    diagnoses: suggestions,
    symptomAssociations,
  };
};

/**
 * 获取诊断置信度详情
 */
export const getConfidenceDetails = async (
  diagnosisId: number,
  symptoms: string[],
  redFlags: string[]
) => {
  const diagnosis = await prisma.diagnosis.findUnique({
    where: { id: diagnosisId },
    include: {
      symptoms: true,
      redFlags: true,
    },
  });

  if (!diagnosis) {return null;}

  const diagnosisSymptoms = diagnosis.symptoms.filter((s) => !s.isExcluding);
  const supportingEvidence = symptoms.filter((s) =>
    diagnosisSymptoms.some((ds) => ds.symptomKey === s)
  );

  const excludingSymptoms = diagnosis.symptoms.filter((s) => s.isExcluding);
  const conflictingEvidence = symptoms.filter((s) =>
    excludingSymptoms.some((ds) => ds.symptomKey === s)
  );

  const missingEvidence = diagnosisSymptoms
    .filter((s) => !symptoms.includes(s.symptomKey))
    .map((s) => s.symptomKey);

  const matchedRedFlags = diagnosis.redFlags.filter((rf) =>
    redFlags.includes(rf.redFlagName)
  );

  return {
    diagnosis: diagnosis.name,
    supportingEvidence,
    conflictingEvidence,
    missingEvidence,
    redFlags: matchedRedFlags.map((rf) => ({
      name: rf.redFlagName,
      severity: rf.severityLevel,
    })),
  };
};

/**
 * 初始化诊断数据（从硬编码数据迁移）
 * 仅在系统初始化时调用
 */
export const initDiagnosisData = async () => {
  // 检查是否已有数据
  const count = await prisma.diagnosis.count();
  if (count > 0) {
    console.log('[DiagnosisService] 诊断数据已存在，跳过初始化');
    return;
  }

  // 基础诊断数据
  const baseDiagnoses = [
    {
      name: '上呼吸道感染',
      description: '由病毒或细菌引起的上呼吸道炎症',
      category: '呼吸系统',
      symptoms: ['fever', 'cough', 'sore_throat', 'runny_nose', 'nasal_congestion'],
      redFlags: ['高热不退', '意识障碍', '呼吸困难'],
    },
    {
      name: '肺炎',
      description: '肺部实质的急性炎症',
      category: '呼吸系统',
      symptoms: ['fever', 'cough', 'sputum', 'chest_pain', 'dyspnea'],
      redFlags: ['呼吸困难', '紫绀', '意识障碍'],
    },
    {
      name: '急性支气管炎',
      description: '支气管黏膜的急性炎症',
      category: '呼吸系统',
      symptoms: ['cough', 'sputum', 'fever', 'chest_tightness'],
      redFlags: ['持续高热', '呼吸困难'],
    },
    {
      name: '慢性阻塞性肺疾病',
      description: '持续性气流受限的肺部疾病',
      category: '呼吸系统',
      minAge: 40,
      symptoms: ['cough', 'sputum', 'dyspnea', 'wheezing'],
      redFlags: ['严重呼吸困难', '紫绀'],
    },
    {
      name: '支气管哮喘',
      description: '气道慢性炎症性疾病',
      category: '呼吸系统',
      maxAge: 60,
      symptoms: ['wheezing', 'dyspnea', 'cough', 'chest_tightness'],
      redFlags: ['严重呼吸困难', '无法平卧'],
    },
    {
      name: '肺结核',
      description: '由结核分枝杆菌引起的肺部感染',
      category: '呼吸系统',
      symptoms: ['fever', 'night_sweats', 'cough', 'hemoptysis', 'weight_loss'],
      redFlags: ['大咯血', '严重呼吸困难'],
    },
    {
      name: '急性胃肠炎',
      description: '胃肠黏膜的急性炎症',
      category: '消化系统',
      symptoms: ['abdominal_pain', 'diarrhea', 'nausea', 'vomiting', 'fever'],
      redFlags: ['严重脱水', '血便', '持续呕吐'],
    },
    {
      name: '消化性溃疡',
      description: '胃肠道黏膜被胃酸和胃蛋白酶消化形成的溃疡',
      category: '消化系统',
      symptoms: ['upper_abdominal_pain', 'nausea', 'vomiting', 'melena'],
      redFlags: ['呕血', '黑便', '剧烈腹痛'],
    },
    {
      name: '急性阑尾炎',
      description: '阑尾的急性炎症',
      category: '消化系统',
      symptoms: ['right_lower_abdominal_pain', 'fever', 'nausea', 'vomiting'],
      redFlags: ['腹膜刺激征', '高热', '休克'],
    },
    {
      name: '急性胰腺炎',
      description: '胰腺的急性炎症',
      category: '消化系统',
      symptoms: ['upper_abdominal_pain', 'nausea', 'vomiting', 'fever'],
      redFlags: ['休克', '呼吸困难', '意识障碍'],
    },
    {
      name: '脑梗死',
      description: '脑部血液供应障碍导致脑组织缺血缺氧性坏死',
      category: '神经系统',
      minAge: 50,
      symptoms: ['hemiplegia', 'slurred_speech', 'headache', 'vertigo'],
      redFlags: ['意识障碍', '瞳孔不等大'],
    },
    {
      name: '脑出血',
      description: '脑实质内血管破裂引起的出血',
      category: '神经系统',
      minAge: 40,
      symptoms: ['headache', 'vomiting', 'altered_consciousness', 'hemiplegia'],
      redFlags: ['意识障碍', '瞳孔不等大', '呼吸不规则'],
    },
    {
      name: '偏头痛',
      description: '反复发作的原发性头痛',
      category: '神经系统',
      symptoms: ['headache', 'nausea', 'vomiting', 'photophobia'],
      redFlags: ['剧烈头痛', '意识改变'],
    },
    {
      name: '高血压',
      description: '动脉血压持续升高',
      category: '心血管系统',
      minAge: 35,
      symptoms: ['headache', 'vertigo', 'palpitation', 'chest_tightness'],
      redFlags: ['血压急剧升高', '意识障碍'],
    },
  ];

  for (const data of baseDiagnoses) {
    const { symptoms, redFlags, ...diagnosisData } = data;

    // 创建诊断
    const diagnosis = await prisma.diagnosis.create({
      data: diagnosisData,
    });

    // 创建症状关联
    for (const symptomKey of symptoms) {
      await prisma.diagnosisSymptom.create({
        data: {
          diagnosisId: diagnosis.id,
          symptomKey,
          weight: 0.1,
          isRequired: false,
        },
      });
    }

    // 创建警惕征象关联
    for (const redFlag of redFlags) {
      await prisma.diagnosisRedFlag.create({
        data: {
          diagnosisId: diagnosis.id,
          redFlagName: redFlag,
          weight: 0.15,
          severityLevel: 3,
        },
      });
    }
  }

  console.log(`[DiagnosisService] 已初始化 ${baseDiagnoses.length} 个诊断数据`);
};
