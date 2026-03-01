/**
 * 密码强度验证工具
 * 确保用户设置的加密密码足够强健
 */

/**
 * 密码复杂度配置
 */
export const PASSWORD_CONFIG = {
  minLength: 12,
  maxLength: 64,
  requireUpperCase: true,
  requireLowerCase: true,
  requireNumber: true,
  requireSpecialChar: true,
  forbidCommonPasswords: true,
  forbidPersonalInfo: true,
  maxRepeatingChars: 3,
  maxSequentialChars: 4,
} as const;

/**
 * 密码强度等级
 */
export enum PasswordStrength {
  WEAK = 0,
  FAIR = 1,
  GOOD = 2,
  STRONG = 3,
}

/**
 * 密码验证结果
 */
export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  score: number;
  errors: string[];
  warnings: string[];
}

/**
 * 密码强度阈值
 */
const STRENGTH_THRESHOLDS = {
  WEAK: 80,
  FAIR: 85,
  GOOD: 90,
  STRONG: 100,
} as const;

/**
 * 常见弱密码列表
 */
const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'password1', 'password123', 'admin', 'root', 'welcome',
  'monkey', 'dragon', 'master', 'hello', 'letmein',
  'sunshine', 'iloveyou', 'princess', 'adobe123',
  '111111', '000000', '123123', '666666', '888888',
  'abcdef', 'abcdefg', 'abcdefgh', 'abcd1234',
] as const;

/**
 * 键盘模式
 */
const KEYBOARD_PATTERNS = [
  'qwerty', 'qwertyuiop', 'asdfgh', 'asdfghjkl', 'zxcvbn', 'zxcvbnm',
  'qazwsx', 'qazwsxedc', '1qaz', '1qaz2wsx', '!qaz', '!qaz@wsx',
  'poiuyt', 'lkjhgf', 'mnbvcx',
] as const;

/**
 * 检查重复字符
 */
function hasRepeatingChars(password: string, maxRepeat: number): boolean {
  let repeatCount = 1;
  for (let i = 1; i < password.length; i++) {
    if (password[i] === password[i - 1]) {
      repeatCount++;
      if (repeatCount > maxRepeat) {
        return true;
      }
    } else {
      repeatCount = 1;
    }
  }
  return false;
}

/**
 * 检查连续字符（如123, abc）
 */
function hasSequentialChars(password: string, maxSequential: number): boolean {
  const lower = password.toLowerCase();
  
  for (let i = 0; i <= lower.length - maxSequential; i++) {
    let ascending = true;
    let descending = true;
    
    for (let j = 0; j < maxSequential - 1; j++) {
      const current = lower.charCodeAt(i + j);
      const next = lower.charCodeAt(i + j + 1);
      
      if (next !== current + 1) ascending = false;
      if (next !== current - 1) descending = false;
    }
    
    if (ascending || descending) {
      return true;
    }
  }
  
  return false;
}

/**
 * 检查键盘模式
 */
function hasKeyboardPattern(password: string): boolean {
  const lower = password.toLowerCase();
  
  for (const pattern of KEYBOARD_PATTERNS) {
    if (lower.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 计算字符多样性得分
 */
function calculateDiversityScore(password: string): number {
  const uniqueChars = new Set(password.toLowerCase()).size;
  const ratio = uniqueChars / password.length;
  
  if (ratio >= 0.9) return 10;
  if (ratio >= 0.8) return 8;
  if (ratio >= 0.7) return 6;
  if (ratio >= 0.6) return 4;
  if (ratio >= 0.5) return 2;
  return 0;
}

/**
 * 检查密码强度
 */
export function checkPasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  // 基本长度检查 (最高40分)
  if (password.length < PASSWORD_CONFIG.minLength) {
    errors.push(`密码长度至少${PASSWORD_CONFIG.minLength}位`);
  } else if (password.length >= 18) {
    score += 40;
  } else if (password.length >= 16) {
    score += 35;
  } else if (password.length >= 14) {
    score += 30;
  } else {
    score += 25;  // 12-13位
  }

  // 大写字母检查 (最高15分，基础15分)
  if (PASSWORD_CONFIG.requireUpperCase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母');
  } else {
    const upperCount = (password.match(/[A-Z]/g) || []).length;
    if (upperCount >= 3) score += 15;
    else if (upperCount >= 2) score += 15;
    else score += 15;  // 至少有1个就得15分
  }

  // 小写字母检查 (最高15分，基础15分)
  if (PASSWORD_CONFIG.requireLowerCase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母');
  } else {
    const lowerCount = (password.match(/[a-z]/g) || []).length;
    if (lowerCount >= 3) score += 15;
    else if (lowerCount >= 2) score += 15;
    else score += 15;  // 至少有1个就得15分
  }

  // 数字检查 (最高15分，基础15分)
  if (PASSWORD_CONFIG.requireNumber && !/[0-9]/.test(password)) {
    errors.push('密码必须包含数字');
  } else {
    const numberCount = (password.match(/[0-9]/g) || []).length;
    if (numberCount >= 3) score += 15;
    else if (numberCount >= 2) score += 15;
    else score += 15;  // 至少有1个就得15分
  }

  // 特殊字符检查 (最高15分，基础15分)
  if (PASSWORD_CONFIG.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"|\\<>,.?/]/.test(password)) {
    errors.push('密码必须包含特殊字符');
  } else {
    const specialCount = (password.match(/[!@#$%^&*()_+\-=\[\]{};':"|\\<>,.?/]/g) || []).length;
    if (specialCount >= 3) score += 15;
    else if (specialCount >= 2) score += 15;
    else score += 15;  // 至少有1个就得15分
  }

  // 常见密码检查
  if (PASSWORD_CONFIG.forbidCommonPasswords && COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('密码过于常见，请使用更复杂的密码');
    score = 0;
  }

  // 最大长度检查
  if (password.length > PASSWORD_CONFIG.maxLength) {
    errors.push(`密码长度不能超过${PASSWORD_CONFIG.maxLength}位`);
  }

  // 重复字符检查
  if (hasRepeatingChars(password, PASSWORD_CONFIG.maxRepeatingChars)) {
    errors.push('密码包含过多重复字符');
    score = Math.max(0, score - 10);
  }

  // 连续字符检查
  if (hasSequentialChars(password, PASSWORD_CONFIG.maxSequentialChars)) {
    errors.push('密码包含连续字符');
    score = Math.max(0, score - 8);
  }

  // 键盘模式检查
  if (hasKeyboardPattern(password)) {
    errors.push('密码包含键盘模式');
    score = Math.max(0, score - 8);
  }

  // 字符多样性加分 (最高10分)
  score += calculateDiversityScore(password);

  // 计算最终强度
  const strength = calculateStrength(score);

  // 如果有警告但通过基本验证，添加建议
  if (errors.length === 0 && strength < PasswordStrength.GOOD) {
    warnings.push('建议使用更复杂的密码以提高安全性');
  }

  return {
    isValid: errors.length === 0,
    strength,
    score: Math.min(100, score),
    errors,
    warnings,
  };
}

/**
 * 计算密码强度
 */
function calculateStrength(score: number): PasswordStrength {
  if (score >= STRENGTH_THRESHOLDS.GOOD) return PasswordStrength.STRONG;
  if (score >= STRENGTH_THRESHOLDS.FAIR) return PasswordStrength.GOOD;
  if (score >= STRENGTH_THRESHOLDS.WEAK) return PasswordStrength.FAIR;
  return PasswordStrength.WEAK;
}

/**
 * 检查密码是否包含个人信息
 */
export function containsPersonalInfo(
  password: string,
  personalInfo?: {
    username?: string;
    name?: string;
    email?: string;
  }
): boolean {
  if (!PASSWORD_CONFIG.forbidPersonalInfo || !personalInfo) {
    return false;
  }

  const lowerPassword = password.toLowerCase();
  let contains = false;

  if (personalInfo.username && lowerPassword.includes(personalInfo.username.toLowerCase())) {
    contains = true;
  }
  if (personalInfo.name && lowerPassword.includes(personalInfo.name.toLowerCase())) {
    contains = true;
  }
  if (personalInfo.email && lowerPassword.includes(personalInfo.email.split('@')[0].toLowerCase())) {
    contains = true;
  }

  return contains;
}

/**
 * 生成随机密码建议
 */
export function generatePasswordSuggestion(length: number = 16): string {
  const chars = {
    upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    lower: 'abcdefghijkmnpqrstuvwxyz',
    number: '23456789',
    special: '!@#$%^&*',
  };

  let password = '';
  
  // 确保每种字符至少有2个
  for (let i = 0; i < 2; i++) {
    password += chars.upper[Math.floor(Math.random() * chars.upper.length)];
    password += chars.lower[Math.floor(Math.random() * chars.lower.length)];
    password += chars.number[Math.floor(Math.random() * chars.number.length)];
    password += chars.special[Math.floor(Math.random() * chars.special.length)];
  }

  for (let i = 8; i < length; i++) {
    const charSet = chars.lower + chars.upper + chars.number + chars.special;
    password += charSet[Math.floor(Math.random() * charSet.length)];
  }

  return password;
}

/**
 * 获取密码强度描述
 */
export function getStrengthDescription(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.WEAK:
      return '弱';
    case PasswordStrength.FAIR:
      return '一般';
    case PasswordStrength.GOOD:
      return '良好';
    case PasswordStrength.STRONG:
      return '强';
  }
}

/**
 * 验证密码重置
 */
export function validatePasswordReset(
  newPassword: string,
  confirmPassword: string,
  currentPassword?: string
): { isValid: boolean; error?: string } {
  if (newPassword !== confirmPassword) {
    return {
      isValid: false,
      error: '两次输入的密码不一致',
    };
  }

  if (currentPassword && newPassword === currentPassword) {
    return {
      isValid: false,
      error: '新密码不能与当前密码相同',
    };
  }

  const validation = checkPasswordStrength(newPassword);
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.errors[0],
    };
  }

  return { isValid: true };
}
