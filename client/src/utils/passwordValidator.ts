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
} as const;

/**
 * 常见弱密码列表
 */
const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'password1', 'password123', 'admin', 'root', 'welcome',
  'monkey', 'dragon', 'master', 'hello', 'letmein',
  'sunshine', 'iloveyou', 'princess', 'adobe123',
] as const;

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
 * 检查密码强度
 */
export function checkPasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  if (password.length < PASSWORD_CONFIG.minLength) {
    errors.push(`密码长度至少${PASSWORD_CONFIG.minLength}位`);
  } else if (password.length >= PASSWORD_CONFIG.minLength && password.length < 14) {
    score += 10;
  } else if (password.length >= 14 && password.length < 18) {
    score += 20;
  } else {
    score += 30;
  }

  if (PASSWORD_CONFIG.requireUpperCase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母');
  } else {
    score += 10;
  }

  if (PASSWORD_CONFIG.requireLowerCase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母');
  } else {
    score += 10;
  }

  if (PASSWORD_CONFIG.requireNumber && !/[0-9]/.test(password)) {
    errors.push('密码必须包含数字');
  } else {
    score += 10;
  }

  if (PASSWORD_CONFIG.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"|\\<>,.?/]/.test(password)) {
    errors.push('密码必须包含特殊字符');
  } else {
    score += 10;
  }

  if (PASSWORD_CONFIG.forbidCommonPasswords && COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('密码过于常见，请使用更复杂的密码');
    score = 0;
  }

  if (password.length > PASSWORD_CONFIG.maxLength) {
    errors.push(`密码长度不能超过${PASSWORD_CONFIG.maxLength}位`);
  }

  const strength = calculateStrength(score);

  if (strength < PasswordStrength.GOOD) {
    warnings.push('建议使用更复杂的密码以提高安全性');
  }

  return {
    isValid: errors.length === 0,
    strength,
    score,
    errors,
    warnings,
  };
}

/**
 * 计算密码强度
 */
function calculateStrength(score: number): PasswordStrength {
  if (score >= 40) return PasswordStrength.STRONG;
  if (score >= 30) return PasswordStrength.GOOD;
  if (score >= 20) return PasswordStrength.FAIR;
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
  
  password += chars.upper[Math.floor(Math.random() * chars.upper.length)];
  password += chars.lower[Math.floor(Math.random() * chars.lower.length)];
  password += chars.number[Math.floor(Math.random() * chars.number.length)];
  password += chars.special[Math.floor(Math.random() * chars.special.length)];

  for (let i = 4; i < length; i++) {
    const charSet = chars.lower + chars.upper + chars.number + chars.special;
    password += charSet[Math.floor(Math.random() * charSet.length)];
  }

  return password;
}

/**
 * 检查密码是否在常见密码列表中
 */
function isInCommonPasswords(password: string): boolean {
  return COMMON_PASSWORDS.includes(password.toLowerCase());
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
