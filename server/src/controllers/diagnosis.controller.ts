import { Request, Response } from 'express';
import { SYMPTOM_NAME_TO_KEY } from '../services/mapping.service';

// Mock Diagnosis Knowledge Base
// In a real system, this would come from a database or AI model
const DIAGNOSIS_RULES: Record<string, string[]> = {
  "fever": ["上呼吸道感染", "肺炎", "肺结核", "败血症", "流行性感冒"],
  "cough": ["急性支气管炎", "肺炎", "支气管哮喘", "慢性阻塞性肺疾病(COPD)", "肺癌", "肺结核"],
  "abdominal_pain": ["急性胃肠炎", "急性阑尾炎", "急性胆囊炎", "急性胰腺炎", "肠梗阻", "消化性溃疡"],
  "chest_pain": ["心绞痛", "急性心肌梗死", "气胸", "肋间神经痛", "反流性食管炎", "肺栓塞"],
  "headache": ["偏头痛", "紧张性头痛", "丛集性头痛", "高血压", "脑膜炎", "颅内肿瘤"],
  "diarrhea": ["急性胃肠炎", "细菌性痢疾", "溃疡性结肠炎", "肠易激综合征", "食物中毒"],
  "nausea_vomiting": ["急性胃肠炎", "早孕反应", "颅内高压", "前庭功能障碍", "幽门梗阻"],
  "dyspnea": ["支气管哮喘", "慢性阻塞性肺疾病", "左心衰竭", "气胸", "肺栓塞", "贫血"],
  "palpitation": ["心律失常", "甲状腺功能亢进", "贫血", "焦虑症", "心力衰竭"],
  "hemoptysis": ["肺结核", "支气管扩张", "肺癌", "肺炎", "肺栓塞"],
  "hematemesis": ["消化性溃疡", "急性胃黏膜病变", "食管胃底静脉曲张破裂", "胃癌"],
  "vertigo": ["梅尼埃病", "良性阵发性位置性眩晕(BPPV)", "前庭神经元炎", "椎基底动脉供血不足"],
  "fatigue": ["贫血", "糖尿病", "甲状腺功能减退", "抑郁症", "恶性肿瘤", "结核病"]
};

export const suggestDiagnosis = async (req: Request, res: Response) => {
    try {
        const { symptoms, gender, age } = req.body;
        // symptoms: string[] (e.g., ['fever', 'cough'])
        
        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
             return res.json({
                success: true,
                data: []
            });
        }

        const diagnosisScores: Map<string, number> = new Map();

        for (const s of symptoms) {
            const key = SYMPTOM_NAME_TO_KEY[s] || s;
            const potentialList = DIAGNOSIS_RULES[key];
            if (potentialList) {
                potentialList.forEach(d => {
                    const current = diagnosisScores.get(d) || 0;
                    diagnosisScores.set(d, current + 1);
                });
            }
        }

        // Sort by score
        const sortedDiagnoses = Array.from(diagnosisScores.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        // Return top 5
        res.json({
            success: true,
            data: sortedDiagnoses.slice(0, 5)
        });

    } catch (error) {
        console.error('Diagnosis error:', error);
        res.status(500).json({ success: false, message: "Error generating diagnosis" });
    }
};
