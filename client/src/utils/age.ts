import dayjs, { type Dayjs } from 'dayjs';

export type AgePrecision = 'auto' | 'years' | 'months';
export type AgeDisplayFormat = 'years' | 'months' | 'years_months';

export type AgeValue = {
  years: number;
  months: number;
  totalMonths: number;
};

export type AgeValidationSeverity = 'info' | 'warning' | 'error';

export type AgeValidationIssue = {
  message: string;
  severity: AgeValidationSeverity;
  normalizedAge?: AgeValue;
};

export type AgeGroup = {
  label: string;
  cssClass: 'age-newborn' | 'age-infant' | 'age-child' | 'age-adult';
};

export type AgeDisplay = {
  mainText: string;
  backupText?: string;
  yearsFloat: number;
  totalDays: number;
  totalMonthsInt: number;
  yearsPart: number;
  monthsPart: number;
  group: AgeGroup;
};

type DateLike = string | number | Date | Dayjs | null | undefined;

const clampNumber = (n: number, min: number, max: number): number => {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

const toDayjs = (v: DateLike): Dayjs | null => {
  if (v === null || v === undefined) return null;
  const d = dayjs(v);
  return d.isValid() ? d : null;
};

export const normalizeAge = (age: { years?: number; months?: number } | null | undefined): AgeValue => {
  const yearsRaw = typeof age?.years === 'number' ? age.years : Number(age?.years);
  const monthsRaw = typeof age?.months === 'number' ? age.months : Number(age?.months);
  const years = Number.isFinite(yearsRaw) ? Math.max(0, Math.floor(yearsRaw)) : 0;
  const months = Number.isFinite(monthsRaw) ? Math.max(0, Math.floor(monthsRaw)) : 0;
  const carriedYears = years + Math.floor(months / 12);
  const leftMonths = months % 12;
  const safeYears = clampNumber(carriedYears, 0, 150);
  const safeMonths = clampNumber(leftMonths, 0, 11);
  return { years: safeYears, months: safeMonths, totalMonths: safeYears * 12 + safeMonths };
};

export const getAgeGroup = (age: { years: number; months: number }): AgeGroup => {
  const years = Math.max(0, Math.floor(age.years));
  const months = Math.max(0, Math.floor(age.months));

  if (years === 0 && months < 1) return { label: '新生儿', cssClass: 'age-newborn' };
  if (years === 0 && months < 12) return { label: '婴儿', cssClass: 'age-infant' };
  if (years < 18) return { label: '儿童', cssClass: 'age-child' };
  return { label: '成人', cssClass: 'age-adult' };
};

export const formatAgeText = (
  yearsInput: number,
  monthsInput: number,
  precision: AgePrecision = 'auto',
  displayFormat: AgeDisplayFormat = 'years_months'
): string => {
  const { years, months } = normalizeAge({ years: yearsInput, months: monthsInput });

  if (precision === 'years') return `${years}岁`;
  if (precision === 'months') return `${years * 12 + months}个月`;

  if (displayFormat === 'years') return `${years}岁`;
  if (displayFormat === 'months') return `${years * 12 + months}个月`;

  if (years === 0) return `${months}个月`;
  if (months === 0) return `${years}岁`;
  return `${years}岁${months}月`;
};

export const getResponsiveAgeDisplayText = (age: { years: number; months: number }, screenWidth: number): string => {
  const { years, months } = normalizeAge(age);
  const isMobile = screenWidth < 768;

  if (isMobile) {
    if (years >= 5) return `${years}岁`;
    if (months === 0) return `${years}岁`;
    return `${years}岁${months}月`;
  }

  if (years === 0) return `${months}个月`;
  if (months === 0) return `${years}岁`;
  return `${years}岁${months}个月`;
};

export const computeAgeDisplay = (birthDate: DateLike, referenceDate: DateLike): AgeDisplay | null => {
  const birth = toDayjs(birthDate);
  const ref = toDayjs(referenceDate);
  if (!birth || !ref) return null;

  const safeBirth = birth.startOf('day');
  const safeRef = ref.startOf('day');
  const totalDays = Math.max(0, safeRef.diff(safeBirth, 'day'));
  const totalMonthsInt = Math.max(0, ref.diff(birth, 'month'));
  const yearsPart = Math.floor(totalMonthsInt / 12);
  const monthsPart = totalMonthsInt % 12;
  const totalMonthsFloat = Math.max(0, ref.diff(birth, 'month', true));
  const yearsFloat = Math.max(0, Math.round((totalMonthsFloat / 12) * 100) / 100);

  const group = getAgeGroup({ years: yearsPart, months: monthsPart });

  if (totalMonthsFloat < 1) {
    const weeks = Math.floor(totalDays / 7);
    const daysRemainder = totalDays % 7;
    const mainText = totalDays < 7 ? `${totalDays}天` : (daysRemainder === 0 ? `${weeks}周` : `${weeks}周${daysRemainder}天`);
    const monthsApprox = Math.max(0.0, Math.round(totalMonthsFloat * 10) / 10);
    return {
      mainText,
      backupText: `${monthsApprox}个月`,
      yearsFloat,
      totalDays,
      totalMonthsInt,
      yearsPart,
      monthsPart,
      group,
    };
  }

  if (totalMonthsInt < 24) {
    return {
      mainText: `${totalMonthsInt}个月`,
      backupText: `${yearsPart}岁${monthsPart}月`,
      yearsFloat,
      totalDays,
      totalMonthsInt,
      yearsPart,
      monthsPart,
      group,
    };
  }

  if (totalMonthsInt < 60) {
    return {
      mainText: `${yearsPart}岁${monthsPart}月`,
      backupText: `${yearsPart}岁`,
      yearsFloat,
      totalDays,
      totalMonthsInt,
      yearsPart,
      monthsPart,
      group,
    };
  }

  if (totalMonthsInt < 144) {
    return {
      mainText: `${yearsPart}岁`,
      backupText: monthsPart > 0 ? `${yearsPart}岁${monthsPart}月` : undefined,
      yearsFloat,
      totalDays,
      totalMonthsInt,
      yearsPart,
      monthsPart,
      group,
    };
  }

  return {
    mainText: `${yearsPart}岁`,
    yearsFloat,
    totalDays,
    totalMonthsInt,
    yearsPart,
    monthsPart,
    group,
  };
};

export const parseAgeText = (text: string): AgeValue | null => {
  const input = String(text ?? '').trim();
  if (!input) return null;

  const patterns: Array<{ re: RegExp; kind: 'ym' | 'yfloat' | 'y' | 'm' }> = [
    { re: /(\d+)\s*岁\s*(\d+)\s*个?\s*月/, kind: 'ym' },
    { re: /(\d+(?:\.\d+)?)\s*岁/, kind: 'yfloat' },
    { re: /(\d+)\s*岁/, kind: 'y' },
    { re: /(\d+)\s*个?\s*月/, kind: 'm' },
  ];

  for (const p of patterns) {
    const m = input.match(p.re);
    if (!m) continue;

    if (p.kind === 'ym') {
      return normalizeAge({ years: Number(m[1]), months: Number(m[2]) });
    }

    if (p.kind === 'm') {
      const months = Number(m[1]);
      const years = Math.floor(months / 12);
      const leftMonths = months % 12;
      return normalizeAge({ years, months: leftMonths });
    }

    if (p.kind === 'yfloat') {
      const yearsFloat = Number(m[1]);
      if (!Number.isFinite(yearsFloat)) return null;
      const years = Math.floor(yearsFloat);
      const months = Math.round((yearsFloat - years) * 12);
      return normalizeAge({ years, months });
    }

    return normalizeAge({ years: Number(m[1]), months: 0 });
  }

  return null;
};

export const validateAge = (age: { years: number; months: number }): AgeValidationIssue[] => {
  const issues: AgeValidationIssue[] = [];
  const normalized = normalizeAge(age);

  if (normalized.years > 150) {
    issues.push({ severity: 'warning', message: '年龄超过150岁，请确认输入正确' });
  }

  if (age.years === 0 && age.months > 12) {
    issues.push({
      severity: 'info',
      message: '月龄超过12个月，已自动转换为岁+月格式',
      normalizedAge: normalized,
    });
  }

  if (age.months >= 12) {
    issues.push({
      severity: 'info',
      message: '月数超过11，已自动进位为岁',
      normalizedAge: normalized,
    });
  }

  return issues;
};

export const calculateAgeParts = (birthDate: DateLike, referenceDate: DateLike = new Date()): {
  years: number;
  months: number;
  days: number;
} | null => {
  const birthD = toDayjs(birthDate)?.startOf('day')?.toDate();
  const refD = toDayjs(referenceDate)?.startOf('day')?.toDate();
  if (!birthD || !refD) return null;

  const birth = new Date(birthD.getFullYear(), birthD.getMonth(), birthD.getDate());
  const ref = new Date(refD.getFullYear(), refD.getMonth(), refD.getDate());

  if (ref.getTime() < birth.getTime()) return { years: 0, months: 0, days: 0 };

  let years = ref.getFullYear() - birth.getFullYear();
  let months = ref.getMonth() - birth.getMonth();
  let days = ref.getDate() - birth.getDate();

  if (days < 0) {
    const prevMonthLastDay = new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
    days += prevMonthLastDay;
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  years = Math.max(0, years);
  months = Math.max(0, months);
  days = Math.max(0, days);

  return { years, months, days };
};
