/**
 * 通用安全验证模块
 * 为所有问诊表单板块提供统一的安全防护功能
 * 包括：数据验证、XSS防护、输入清理、数据完整性校验
 */

/**
 * 默认最大文本长度
 */
export const DEFAULT_MAX_TEXT_LENGTH = 500;
export const DEFAULT_MAX_SHORT_TEXT_LENGTH = 100;
export const DEFAULT_MAX_LONG_TEXT_LENGTH = 2000;

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
  /<img[^>]+onerror/gi,
  /<svg[^>]+onload/gi,
  /expression\s*\(/gi,
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
 * SQL注入危险模式
 */
const SQL_INJECTION_PATTERNS = [
  /(\bor\b|\band\b|\bxor\b)\s*['"]?\d+['"]?\s*=\s*['"]?\d+/gi,
  /union\s+select/gi,
  /;\s*(drop|delete|truncate|update|insert)/gi,
  /--\s*$/gm,
  /\/\*[\s\S]*?\*\//g,
];

/**
 * XSS防护：转义HTML特殊字符
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * XSS防护：检测输入是否包含恶意内容
 */
export function containsMaliciousContent(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * XSS防护：清理输入中的恶意内容
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
 * SQL注入防护：检测输入是否包含SQL注入模式
 */
export function containsSqlInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * 验证文本字段
 */
export function validateText(
  text: unknown,
  maxLength: number = DEFAULT_MAX_TEXT_LENGTH,
  required: boolean = false
): { valid: boolean; error?: string; sanitized?: string } {
  if (text === undefined || text === null || text === '') {
    if (required) {
      return { valid: false, error: '此字段为必填项' };
    }
    return { valid: true, sanitized: '' };
  }
  
  if (typeof text !== 'string') {
    return { valid: false, error: '输入格式错误' };
  }
  
  if (text.length > maxLength) {
    return { valid: false, error: `内容长度不能超过${maxLength}个字符` };
  }
  
  if (containsMaliciousContent(text)) {
    return { valid: false, error: '输入包含不允许的内容' };
  }
  
  if (containsSqlInjection(text)) {
    return { valid: false, error: '输入包含不允许的内容' };
  }
  
  const sanitized = sanitizeInput(text);
  
  return { valid: true, sanitized };
}

/**
 * 验证数字字段
 */
export function validateNumber(
  value: unknown,
  min?: number,
  max?: number,
  required: boolean = false
): { valid: boolean; error?: string; value?: number } {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return { valid: false, error: '此字段为必填项' };
    }
    return { valid: true };
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN;
  
  if (!Number.isFinite(num)) {
    return { valid: false, error: '请输入有效的数字' };
  }
  
  if (min !== undefined && num < min) {
    return { valid: false, error: `数值不能小于${min}` };
  }
  
  if (max !== undefined && num > max) {
    return { valid: false, error: `数值不能大于${max}` };
  }
  
  return { valid: true, value: num };
}

/**
 * 验证选择字段
 */
export function validateSelect<T extends string>(
  value: unknown,
  allowedValues: readonly T[] | T[],
  required: boolean = false
): { valid: boolean; error?: string; value?: T } {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return { valid: false, error: '请选择一个选项' };
    }
    return { valid: true };
  }
  
  if (typeof value !== 'string') {
    return { valid: false, error: '选择的值无效' };
  }
  
  if (!allowedValues.includes(value as T)) {
    return { valid: false, error: '选择的值无效' };
  }
  
  return { valid: true, value: value as T };
}

/**
 * 验证多选字段
 */
export function validateMultiSelect<T extends string>(
  values: unknown,
  allowedValues: readonly T[] | T[]
): { valid: boolean; values: T[] } {
  if (!Array.isArray(values)) {
    return { valid: true, values: [] };
  }
  
  const validValues = values.filter((v): v is T => 
    typeof v === 'string' && allowedValues.includes(v as T)
  );
  
  return { valid: true, values: validValues };
}

/**
 * 递归清理对象中的所有字符串字段
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      if (containsMaliciousContent(value)) {
        result[key] = sanitizeInput(value);
      } else {
        result[key] = value;
      }
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => 
        typeof item === 'string' ? (containsMaliciousContent(item) ? sanitizeInput(item) : item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  
  return result as T;
}

/**
 * 验证完整的表单数据
 */
export function validateFormData(
  formData: Record<string, unknown>,
  sectionName: string
): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  const errors: string[] = [];
  const sanitized = sanitizeObject(formData);
  
  // 检查是否有恶意内容被清理
  const checkForSanitization = (obj: Record<string, unknown>, path: string = ''): void => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string' && containsMaliciousContent(value)) {
        errors.push(`[${sectionName}] ${currentPath}: 检测到恶意内容`);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'string' && containsMaliciousContent(item)) {
            errors.push(`[${sectionName}] ${currentPath}[${index}]: 检测到恶意内容`);
          } else if (typeof item === 'object' && item !== null) {
            checkForSanitization(item as Record<string, unknown>, `${currentPath}[${index}]`);
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        checkForSanitization(value as Record<string, unknown>, currentPath);
      }
    }
  };
  
  checkForSanitization(formData);
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * 验证主诉数据
 */
export function validateChiefComplaint(data: unknown): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: true, errors: [], sanitized: {} };
  }
  
  const cc = data as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  
  // 验证症状
  if (cc.symptom) {
    const result = validateText(cc.symptom, 100, true);
    if (!result.valid && result.error) {
      errors.push(`主诉症状: ${result.error}`);
    }
    sanitized.symptom = result.sanitized || cc.symptom;
  }
  
  // 验证持续时间
  if (cc.durationNum !== undefined) {
    const result = validateNumber(cc.durationNum, 0.5, 1000);
    if (!result.valid && result.error) {
      errors.push(`持续时间: ${result.error}`);
    }
    sanitized.durationNum = result.value;
  }
  
  // 验证时间单位
  const validUnits = ['分钟', '小时', '天', '周', '月', '年'];
  if (cc.durationUnit) {
    const result = validateSelect(cc.durationUnit, validUnits);
    if (!result.valid && result.error) {
      errors.push(`时间单位: ${result.error}`);
    }
    sanitized.durationUnit = result.value;
  }
  
  // 验证完整主诉文本
  if (cc.text) {
    const result = validateText(cc.text, 100, true);
    if (!result.valid && result.error) {
      errors.push(`完整主诉: ${result.error}`);
    }
    sanitized.text = result.sanitized || cc.text;
  }
  
  return { valid: errors.length === 0, errors, sanitized };
}

/**
 * 验证现病史数据
 */
export function validatePresentIllness(data: unknown): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  if (!data || typeof data !== 'object') {
    return { valid: true, errors: [], sanitized: {} };
  }
  
  return validateFormData(data as Record<string, unknown>, '现病史');
}

/**
 * 验证既往史数据
 */
export function validatePastHistory(data: unknown): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  if (!data || typeof data !== 'object') {
    return { valid: true, errors: [], sanitized: {} };
  }
  
  const ph = data as Record<string, unknown>;
  const errors: string[] = [];
  const sanitized: Record<string, unknown> = {};
  
  // 验证疾病史
  const validDiseases = [
    '高血压', '糖尿病', '冠心病', '脑卒中',
    '慢性阻塞性肺疾病(COPD)', '哮喘', '肝炎', '结核', '肾脏疾病', '恶性肿瘤'
  ];
  
  if (ph.pmh_diseases) {
    const result = validateMultiSelect(ph.pmh_diseases, validDiseases);
    sanitized.pmh_diseases = result.values;
  }
  
  // 验证其他文本字段
  const textFields = ['illnessHistory', 'infectiousHistory', 'vaccinationHistory'];
  for (const field of textFields) {
    if (ph[field]) {
      const result = validateText(ph[field], 2000);
      if (result.sanitized !== undefined) {
        sanitized[field] = result.sanitized;
      }
    }
  }
  
  // 验证数组字段
  const arrayFields = ['surgeries', 'transfusions', 'allergies'];
  for (const field of arrayFields) {
    if (Array.isArray(ph[field])) {
      sanitized[field] = ph[field].map(item => {
        if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item as Record<string, unknown>);
        }
        return item;
      });
    }
  }
  
  return { valid: errors.length === 0, errors, sanitized };
}

/**
 * 验证个人史数据
 */
export function validatePersonalHistory(data: unknown): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  if (!data || typeof data !== 'object') {
    return { valid: true, errors: [], sanitized: {} };
  }
  
  return validateFormData(data as Record<string, unknown>, '个人史');
}

/**
 * 验证家族史数据
 */
export function validateFamilyHistory(data: unknown): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  if (!data || typeof data !== 'object') {
    return { valid: true, errors: [], sanitized: {} };
  }
  
  return validateFormData(data as Record<string, unknown>, '家族史');
}

/**
 * 验证体格检查数据
 */
export function validatePhysicalExam(data: unknown): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  if (!data || typeof data !== 'object') {
    return { valid: true, errors: [], sanitized: {} };
  }
  
  return validateFormData(data as Record<string, unknown>, '体格检查');
}

/**
 * 验证患者基本信息
 */
export function validatePatientInfo(data: unknown): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: true, errors: [], sanitized: {} };
  }
  
  const patient = data as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  
  // 验证姓名
  if (patient.name) {
    const result = validateText(patient.name, 50, true);
    if (!result.valid && result.error) {
      errors.push(`姓名: ${result.error}`);
    }
    sanitized.name = result.sanitized || patient.name;
  }
  
  // 验证性别
  const validGenders = ['男', '女', '其他'];
  if (patient.gender) {
    const result = validateSelect(patient.gender, validGenders, true);
    if (!result.valid && result.error) {
      errors.push(`性别: ${result.error}`);
    }
    sanitized.gender = result.value;
  }
  
  // 验证民族
  const validEthnicities = [
    '汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族',
    '满族', '侗族', '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族',
    '佤族', '畲族', '高山族', '拉祜族', '水族', '东乡族', '纳西族', '景颇族', '柯尔克孜族', '土族',
    '达斡尔族', '仫佬族', '羌族', '布朗族', '撒拉族', '毛南族', '仡佬族', '锡伯族', '阿昌族', '普米族',
    '塔吉克族', '怒族', '乌孜别克族', '俄罗斯族', '鄂温克族', '德昂族', '保安族', '裕固族', '京族', '塔塔尔族',
    '独龙族', '鄂伦春族', '赫哲族', '门巴族', '珞巴族', '基诺族'
  ];
  if (patient.ethnicity) {
    const result = validateSelect(patient.ethnicity, validEthnicities);
    if (!result.valid && result.error) {
      errors.push(`民族: ${result.error}`);
    }
    sanitized.ethnicity = result.value;
  }
  
  // 验证手机号
  if (patient.phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(String(patient.phone))) {
      errors.push('手机号: 请输入有效的11位手机号');
    } else {
      sanitized.phone = patient.phone;
    }
  }
  
  // 验证年龄
  if (patient.age !== undefined) {
    const result = validateNumber(patient.age, 0, 150);
    if (!result.valid && result.error) {
      errors.push(`年龄: ${result.error}`);
    }
    sanitized.age = result.value;
  }
  
  // 复制其他字段（经过清理）
  const otherFields = ['birthDate', 'nativePlace', 'placeOfBirth', 'occupation', 'employer', 'address'];
  for (const field of otherFields) {
    if (patient[field] !== undefined) {
      if (typeof patient[field] === 'string') {
        const result = validateText(patient[field], 200);
        sanitized[field] = result.sanitized || patient[field];
      } else {
        sanitized[field] = patient[field];
      }
    }
  }
  
  return { valid: errors.length === 0, errors, sanitized };
}

/**
 * 全面验证会话数据
 */
export function validateSessionData(
  data: Record<string, unknown>
): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  const errors: string[] = [];
  const sanitized: Record<string, unknown> = {};
  
  // 验证各个板块
  const validators: Record<string, (data: unknown) => { valid: boolean; errors: string[]; sanitized: Record<string, unknown> }> = {
    chiefComplaint: validateChiefComplaint,
    presentIllness: validatePresentIllness,
    pastHistory: validatePastHistory,
    personalHistory: validatePersonalHistory,
    familyHistory: validateFamilyHistory,
    physicalExam: validatePhysicalExam,
    reviewOfSystems: validateFormData.bind(null, undefined as unknown as Record<string, unknown>, '系统回顾'),
  };
  
  // 验证患者信息
  const patientResult = validatePatientInfo(data);
  if (!patientResult.valid) {
    errors.push(...patientResult.errors);
  }
  Object.assign(sanitized, patientResult.sanitized);
  
  // 验证各个板块
  for (const key of Object.keys(validators)) {
    const validator = validators[key];
    if (data[key] !== undefined) {
      const result = validator(data[key]);
      if (!result.valid) {
        errors.push(...result.errors);
      }
      sanitized[key] = result.sanitized;
    }
  }
  
  // 复制其他字段（经过清理）
  const otherFields = ['generalInfo', 'maritalHistory', 'menstrualHistory', 'fertilityHistory', 'specialistExam', 'auxiliaryExams', 'historian', 'reliability', 'historianRelationship'];
  for (const field of otherFields) {
    if (data[field] !== undefined) {
      if (typeof data[field] === 'object' && data[field] !== null) {
        sanitized[field] = sanitizeObject(data[field] as Record<string, unknown>);
      } else if (typeof data[field] === 'string') {
        sanitized[field] = sanitizeInput(data[field]);
      } else {
        sanitized[field] = data[field];
      }
    }
  }
  
  return { valid: errors.length === 0, errors, sanitized };
}
