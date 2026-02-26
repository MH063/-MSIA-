/**
 * 通用安全工具模块
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
 * SQL注入防护：检测输入是否包含SQL注入模式
 * @param input 用户输入的字符串
 * @returns 是否检测到SQL注入模式
 */
export function containsSqlInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * 验证文本字段
 * @param text 文本内容
 * @param maxLength 最大长度
 * @param required 是否必填
 * @returns 验证结果
 */
export function validateText(
  text: string | undefined | null,
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
 * @param value 数值
 * @param min 最小值
 * @param max 最大值
 * @param required 是否必填
 * @returns 验证结果
 */
export function validateNumber(
  value: number | string | undefined | null,
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
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
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
 * @param value 选择的值
 * @param allowedValues 允许的值列表
 * @param required 是否必填
 * @returns 验证结果
 */
export function validateSelect<T extends string>(
  value: T | undefined | null,
  allowedValues: readonly T[] | T[],
  required: boolean = false
): { valid: boolean; error?: string; value?: T } {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return { valid: false, error: '请选择一个选项' };
    }
    return { valid: true };
  }
  
  if (!allowedValues.includes(value)) {
    return { valid: false, error: '选择的值无效' };
  }
  
  return { valid: true, value };
}

/**
 * 验证多选字段
 * @param values 选择的值数组
 * @param allowedValues 允许的值列表
 * @returns 验证结果
 */
export function validateMultiSelect<T extends string>(
  values: T[] | undefined | null,
  allowedValues: readonly T[] | T[]
): { valid: boolean; error?: string; values?: T[] } {
  if (!Array.isArray(values)) {
    return { valid: true, values: [] };
  }
  
  const validValues = values.filter(v => allowedValues.includes(v));
  
  return { valid: true, values: validValues };
}

/**
 * 验证日期字段
 * @param date 日期字符串
 * @param required 是否必填
 * @returns 验证结果
 */
export function validateDate(
  date: string | Date | undefined | null,
  required: boolean = false
): { valid: boolean; error?: string; date?: Date } {
  if (date === undefined || date === null || date === '') {
    if (required) {
      return { valid: false, error: '请选择日期' };
    }
    return { valid: true };
  }
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return { valid: false, error: '日期格式无效' };
  }
  
  const now = new Date();
  if (d > now) {
    return { valid: false, error: '日期不能晚于当前时间' };
  }
  
  return { valid: true, date: d };
}

/**
 * 验证手机号
 * @param phone 手机号
 * @param required 是否必填
 * @returns 验证结果
 */
export function validatePhone(
  phone: string | undefined | null,
  required: boolean = false
): { valid: boolean; error?: string; phone?: string } {
  if (phone === undefined || phone === null || phone === '') {
    if (required) {
      return { valid: false, error: '请输入手机号' };
    }
    return { valid: true };
  }
  
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return { valid: false, error: '请输入有效的11位手机号' };
  }
  
  return { valid: true, phone };
}

/**
 * 验证姓名
 * @param name 姓名
 * @returns 验证结果
 */
export function validateName(
  name: string | undefined | null
): { valid: boolean; error?: string; name?: string } {
  if (!name || name.trim() === '') {
    return { valid: false, error: '请输入姓名' };
  }
  
  if (name.length > 50) {
    return { valid: false, error: '姓名不能超过50个字符' };
  }
  
  if (containsMaliciousContent(name)) {
    return { valid: false, error: '姓名包含不允许的内容' };
  }
  
  return { valid: true, name: name.trim() };
}

/**
 * 递归清理对象中的所有字符串字段
 * @param obj 待清理的对象
 * @returns 清理后的对象
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item) :
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
 * 生成数据校验和（用于数据完整性验证）
 * @param data 数据对象
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
  
  return `form_${Math.abs(hash).toString(16)}`;
}

/**
 * 验证数据校验和
 * @param data 数据对象
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

/**
 * 创建安全的输入处理器
 * @param maxLength 最大长度
 * @param onChange 原始onChange回调
 * @returns 处理后的onChange回调
 */
export function createSecureInputHandler(
  maxLength: number,
  onChange?: (value: string) => void
): (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void {
  return (e) => {
    const value = e.target.value;
    
    if (value.length > maxLength) {
      return;
    }
    
    if (containsMaliciousContent(value)) {
      const sanitized = sanitizeInput(value);
      onChange?.(sanitized);
      return;
    }
    
    onChange?.(value);
  };
}

/**
 * 验证完整的表单数据
 * @param formData 表单数据
 * @param schema 验证规则
 * @returns 验证结果
 */
export function validateFormData<T extends Record<string, unknown>>(
  formData: T,
  schema: Record<keyof T, { type: 'text' | 'number' | 'select' | 'multiselect' | 'date'; required?: boolean; maxLength?: number; min?: number; max?: number; allowedValues?: string[] }>
): { valid: boolean; errors: Record<string, string>; sanitized: T } {
  const errors: Record<string, string> = {};
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, rules] of Object.entries(schema)) {
    const value = formData[key];
    
    switch (rules.type) {
      case 'text': {
        const result = validateText(value as string, rules.maxLength, rules.required);
        if (!result.valid && result.error) {
          errors[key] = result.error;
        }
        sanitized[key] = result.sanitized ?? '';
        break;
      }
      case 'number': {
        const result = validateNumber(value as number, rules.min, rules.max, rules.required);
        if (!result.valid && result.error) {
          errors[key] = result.error;
        }
        sanitized[key] = result.value;
        break;
      }
      case 'select': {
        if (rules.allowedValues) {
          const result = validateSelect(value as string, rules.allowedValues, rules.required);
          if (!result.valid && result.error) {
            errors[key] = result.error;
          }
          sanitized[key] = result.value;
        }
        break;
      }
      case 'multiselect': {
        if (rules.allowedValues) {
          const result = validateMultiSelect(value as string[], rules.allowedValues);
          sanitized[key] = result.values;
        }
        break;
      }
      case 'date': {
        const result = validateDate(value as string, rules.required);
        if (!result.valid && result.error) {
          errors[key] = result.error;
        }
        sanitized[key] = result.date;
        break;
      }
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized: sanitized as T
  };
}

/**
 * 性别选项
 */
export const GENDER_OPTIONS = ['男', '女', '其他'] as const;

/**
 * 婚姻状况选项
 */
export const MARITAL_STATUS_OPTIONS = ['未婚', '已婚', '离异', '丧偶'] as const;

/**
 * 病史陈述者选项
 */
export const HISTORIAN_OPTIONS = ['本人', '家属', '同事/朋友', '其他'] as const;

/**
 * 可靠程度选项
 */
export const RELIABILITY_OPTIONS = ['可靠', '基本可靠', '供参考', '不可评估'] as const;

/**
 * 常见慢性疾病选项
 */
export const COMMON_DISEASES = [
  '高血压', '糖尿病', '冠心病', '脑卒中',
  '慢性阻塞性肺疾病(COPD)', '哮喘', '肝炎', '结核', '肾脏疾病', '恶性肿瘤'
] as const;

/**
 * 过敏严重程度选项
 */
export const ALLERGY_SEVERITY_OPTIONS = ['mild', 'moderate', 'severe'] as const;
