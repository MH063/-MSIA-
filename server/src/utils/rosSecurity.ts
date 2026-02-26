/**
 * 系统回顾(Review of Systems)后端安全验证模块
 * 提供数据验证、XSS防护、数据完整性校验等安全功能
 */

/**
 * 硬编码的系统回顾症状配置（与前端保持一致）
 */
export const ROS_SYSTEMS_CONFIG = [
  {
    key: 'respiratory',
    label: '1. 呼吸系统',
    symptoms: [
      { name: '咳嗽', key: 'cough' },
      { name: '咳痰', key: 'expectoration' },
      { name: '咯血', key: 'hemoptysis' },
      { name: '胸痛', key: 'chest_pain_resp' },
      { name: '呼吸困难', key: 'dyspnea' },
      { name: '哮喘', key: 'asthma' }
    ]
  },
  {
    key: 'cardiovascular',
    label: '2. 循环系统',
    symptoms: [
      { name: '心悸', key: 'palpitation' },
      { name: '胸闷', key: 'chest_tightness' },
      { name: '胸痛', key: 'chest_pain_cardio' },
      { name: '水肿', key: 'edema' },
      { name: '晕厥', key: 'syncope_cardio' },
      { name: '气短', key: 'shortness_of_breath' },
      { name: '夜间阵发性呼吸困难', key: 'paroxysmal_nocturnal_dyspnea' }
    ]
  },
  {
    key: 'digestive',
    label: '3. 消化系统',
    symptoms: [
      { name: '食欲不振', key: 'poor_appetite' },
      { name: '恶心', key: 'nausea' },
      { name: '呕吐', key: 'vomiting' },
      { name: '腹痛', key: 'abdominal_pain' },
      { name: '腹胀', key: 'abdominal_distension' },
      { name: '腹泻', key: 'diarrhea' },
      { name: '便秘', key: 'constipation' },
      { name: '呕血', key: 'hematemesis' },
      { name: '黑便', key: 'melena' },
      { name: '黄疸', key: 'jaundice' }
    ]
  },
  {
    key: 'urinary',
    label: '4. 泌尿系统',
    symptoms: [
      { name: '尿频', key: 'urinary_frequency' },
      { name: '尿急', key: 'urinary_urgency' },
      { name: '尿痛', key: 'dysuria' },
      { name: '血尿', key: 'hematuria' },
      { name: '排尿困难', key: 'difficulty_urinating' },
      { name: '尿量改变', key: 'urine_volume_change' },
      { name: '颜面水肿', key: 'facial_edema' },
      { name: '腰痛', key: 'lumbar_pain' }
    ]
  },
  {
    key: 'hematologic',
    label: '5. 血液系统',
    symptoms: [
      { name: '乏力', key: 'fatigue_hematologic' },
      { name: '头晕', key: 'dizziness_hematologic' },
      { name: '皮肤出血点', key: 'skin_petechiae' },
      { name: '瘀斑', key: 'ecchymosis' },
      { name: '牙龈出血', key: 'gum_bleeding' },
      { name: '鼻出血', key: 'epistaxis' }
    ]
  },
  {
    key: 'endocrine',
    label: '6. 内分泌及代谢',
    symptoms: [
      { name: '多饮', key: 'polydipsia' },
      { name: '多食', key: 'polyphagia' },
      { name: '多尿', key: 'polyuria_endocrine' },
      { name: '体重改变', key: 'weight_change' },
      { name: '怕热', key: 'heat_intolerance' },
      { name: '怕冷', key: 'cold_intolerance' },
      { name: '多汗', key: 'hyperhidrosis' },
      { name: '乏力', key: 'fatigue_endocrine' },
      { name: '毛发改变', key: 'hair_changes' }
    ]
  },
  {
    key: 'neurological',
    label: '7. 神经精神',
    symptoms: [
      { name: '头痛', key: 'headache' },
      { name: '头晕', key: 'dizziness_neurological' },
      { name: '晕厥', key: 'syncope_neurological' },
      { name: '抽搐', key: 'convulsion' },
      { name: '意识障碍', key: 'disturbance_of_consciousness' },
      { name: '失眠', key: 'insomnia' },
      { name: '记忆力下降', key: 'memory_decline' },
      { name: '肢体麻木', key: 'limb_numbness' },
      { name: '瘫痪', key: 'paralysis' }
    ]
  },
  {
    key: 'musculoskeletal',
    label: '8. 肌肉骨骼',
    symptoms: [
      { name: '关节痛', key: 'arthralgia' },
      { name: '关节肿胀', key: 'joint_swelling' },
      { name: '关节僵硬', key: 'joint_stiffness' },
      { name: '肌肉痛', key: 'myalgia' },
      { name: '肌肉萎缩', key: 'muscle_atrophy' },
      { name: '运动受限', key: 'limited_mobility' }
    ]
  }
] as const;

/**
 * 所有有效的系统key集合
 */
export const VALID_SYSTEM_KEYS = new Set<string>(ROS_SYSTEMS_CONFIG.map(s => s.key));

/**
 * 所有有效的症状key集合
 */
export const VALID_SYMPTOM_KEYS = new Set<string>(
  ROS_SYSTEMS_CONFIG.flatMap(s => s.symptoms.map(sym => sym.key))
);

/**
 * 系统key到症状key的映射
 */
export const SYSTEM_TO_SYMPTOMS_MAP: Record<string, Set<string>> = Object.fromEntries(
  ROS_SYSTEMS_CONFIG.map(s => [s.key as string, new Set<string>(s.symptoms.map(sym => sym.key))])
);

/**
 * 详情字段最大长度
 */
export const MAX_DETAILS_LENGTH = 500;

/**
 * XSS危险字符正则表达式
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<form/gi,
  /data:/gi,
  /vbscript:/gi,
];

/**
 * HTML特殊字符转义映射
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * XSS防护：转义HTML特殊字符
 * @param input 用户输入的字符串
 * @returns 转义后的安全字符串
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * XSS防护：检测输入是否包含恶意内容
 * @param input 用户输入的字符串
 * @returns 是否检测到恶意内容
 */
export function containsMaliciousContent(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * XSS防护：清理输入中的恶意内容
 * @param input 用户输入的字符串
 * @returns 清理后的安全字符串
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input;
  
  XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized.trim();
}

/**
 * 验证症状key是否有效
 * @param symptomKey 症状key
 * @returns 是否有效
 */
export function isValidSymptomKey(symptomKey: string): boolean {
  return typeof symptomKey === 'string' && VALID_SYMPTOM_KEYS.has(symptomKey);
}

/**
 * 验证系统key是否有效
 * @param systemKey 系统key
 * @returns 是否有效
 */
export function isValidSystemKey(systemKey: string): boolean {
  return typeof systemKey === 'string' && VALID_SYSTEM_KEYS.has(systemKey);
}

/**
 * 验证症状是否属于指定系统
 * @param systemKey 系统key
 * @param symptomKey 症状key
 * @returns 是否属于该系统
 */
export function isSymptomInSystem(systemKey: string, symptomKey: string): boolean {
  const systemSymptoms = SYSTEM_TO_SYMPTOMS_MAP[systemKey];
  return systemSymptoms ? systemSymptoms.has(symptomKey) : false;
}

/**
 * 验证详情字段
 * @param details 详情文本
 * @returns 验证结果
 */
export function validateDetails(details: unknown): { valid: boolean; error?: string; sanitized?: string } {
  if (details === undefined || details === null || details === '') {
    return { valid: true, sanitized: '' };
  }
  
  if (typeof details !== 'string') {
    return { valid: false, error: '详情必须是文本格式' };
  }
  
  if (details.length > MAX_DETAILS_LENGTH) {
    return { valid: false, error: `详情长度不能超过${MAX_DETAILS_LENGTH}个字符` };
  }
  
  if (containsMaliciousContent(details)) {
    return { valid: false, error: '详情包含不允许的内容' };
  }
  
  const sanitized = sanitizeInput(details);
  
  return { valid: true, sanitized };
}

/**
 * 验证症状数组
 * @param systemKey 系统key
 * @param symptoms 症状key数组
 * @returns 验证结果
 */
export function validateSymptomsArray(
  systemKey: string,
  symptoms: unknown
): { valid: boolean; error?: string; validSymptoms?: string[] } {
  if (!isValidSystemKey(systemKey)) {
    return { valid: false, error: '无效的系统类型' };
  }
  
  if (!Array.isArray(symptoms)) {
    return { valid: false, error: '症状必须是数组格式' };
  }
  
  const validSymptoms: string[] = [];
  const systemSymptoms = SYSTEM_TO_SYMPTOMS_MAP[systemKey];
  
  for (const symptom of symptoms) {
    if (typeof symptom !== 'string') {
      continue;
    }
    
    if (systemSymptoms.has(symptom)) {
      validSymptoms.push(symptom);
    }
  }
  
  return { valid: true, validSymptoms };
}

/**
 * 验证完整的系统回顾数据
 * @param rosData 系统回顾数据
 * @returns 验证结果
 */
export function validateRosData(
  rosData: unknown
): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  const errors: string[] = [];
  const sanitized: Record<string, unknown> = {};
  
  if (!rosData || typeof rosData !== 'object') {
    return { valid: true, errors: [], sanitized: {} };
  }
  
  const data = rosData as Record<string, unknown>;
  
  for (const [key, value] of Object.entries(data)) {
    if (key === 'none') {
      if (typeof value === 'boolean') {
        sanitized.none = value;
      }
      continue;
    }
    
    if (!isValidSystemKey(key)) {
      continue;
    }
    
    if (!value || typeof value !== 'object') {
      continue;
    }
    
    const systemData = value as Record<string, unknown>;
    const sanitizedSystemData: Record<string, unknown> = {};
    
    if (Array.isArray(systemData.symptoms)) {
      const result = validateSymptomsArray(key, systemData.symptoms);
      if (result.validSymptoms && result.validSymptoms.length > 0) {
        sanitizedSystemData.symptoms = result.validSymptoms;
      }
    }
    
    if (typeof systemData.details === 'string') {
      const detailsResult = validateDetails(systemData.details);
      if (detailsResult.valid && detailsResult.sanitized) {
        sanitizedSystemData.details = detailsResult.sanitized;
      }
    }
    
    if (Object.keys(sanitizedSystemData).length > 0) {
      sanitized[key] = sanitizedSystemData;
    }
  }
  
  return { valid: errors.length === 0, errors, sanitized };
}

/**
 * 生成数据校验和（用于数据完整性验证）
 * @param data 系统回顾数据
 * @returns 校验和字符串
 */
export function generateChecksum(data: Record<string, unknown>): string {
  const normalizedData = JSON.stringify(data, Object.keys(data).sort());
  
  let hash = 0;
  for (let i = 0; i < normalizedData.length; i++) {
    const char = normalizedData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return `ros_${Math.abs(hash).toString(16)}`;
}

/**
 * 验证数据校验和
 * @param data 系统回顾数据
 * @param checksum 原始校验和
 * @returns 是否匹配
 */
export function verifyChecksum(data: Record<string, unknown>, checksum: string): boolean {
  if (!checksum || typeof checksum !== 'string') {
    return false;
  }
  
  const expectedChecksum = generateChecksum(data);
  return expectedChecksum === checksum;
}
