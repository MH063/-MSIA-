export type DurationUnit = '分钟' | '小时' | '天' | '周' | '月' | '年';

export type DurationValue = number | { min: number; max: number };

export interface ChiefComplaintParseResult {
  complaint_text: string;
  duration_value: DurationValue | null;
  duration_unit: DurationUnit | null;
  duration_raw: string | null;
  normalized_text: string;
  confidence: number;
  failure_reason: string | null;
}

type UnitMatch = {
  raw: string;
  unit: DurationUnit;
};

type DurationCandidate = {
  start: number;
  end: number;
  raw: string;
  value: DurationValue;
  unit: DurationUnit;
  score: number;
};

const DURATION_KEYWORDS = ['持续', '已', '近', '约', '病程', '反复', '余', '多'] as const;

const UNIT_RULES: Array<{ unit: DurationUnit; patterns: RegExp[] }> = [
  { unit: '分钟', patterns: [/分钟/u, /\bmin\b/iu, /分/u] },
  { unit: '小时', patterns: [/小时/u, /\bhr\b/iu, /\bh\b/iu, /时/u] },
  { unit: '天', patterns: [/天/u, /日/u, /\bd\b/iu] },
  { unit: '周', patterns: [/星期/u, /周/u, /\bw\b/iu] },
  { unit: '月', patterns: [/月/u, /\bm\b/iu] },
  { unit: '年', patterns: [/年/u, /\by\b/iu] },
];

const FULLWIDTH_DIGITS: Record<string, string> = {
  '０': '0',
  '１': '1',
  '２': '2',
  '３': '3',
  '４': '4',
  '５': '5',
  '６': '6',
  '７': '7',
  '８': '8',
  '９': '9',
};

const ROMAN_VALUE: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/gu, ' ').trim();
}

function normalizeFullwidthDigits(input: string) {
  return input.replace(/[０-９]/gu, (c) => FULLWIDTH_DIGITS[c] || c);
}

function normalizeText(input: string) {
  const t = normalizeWhitespace(normalizeFullwidthDigits(String(input || '')));
  return t;
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function parseRomanNumber(input: string): number | null {
  const s = String(input || '').trim().toUpperCase();
  if (!s || !/^[IVXLCDM]+$/u.test(s)) return null;
  let total = 0;
  let prev = 0;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    const n = ROMAN_VALUE[s[i]];
    if (!n) return null;
    if (n < prev) total -= n;
    else {
      total += n;
      prev = n;
    }
  }
  return total > 0 ? total : null;
}

function parseChineseNumber(input: string): number | null {
  const s = String(input || '').trim();
  if (!s) return null;
  if (s === '半') return 0.5;
  if (!/^[零〇一二三四五六七八九十百千两]+$/u.test(s)) return null;

  const digit: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    两: 2,
  };
  const unit: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };

  let total = 0;
  let current = 0;
  for (const ch of s) {
    if (ch in digit) {
      current = digit[ch];
      continue;
    }
    if (ch in unit) {
      const u = unit[ch];
      const n = current === 0 ? 1 : current;
      total += n * u;
      current = 0;
      continue;
    }
    return null;
  }
  return total + current;
}

function parseNumberToken(input: string): number | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const arabic = Number(raw);
  if (Number.isFinite(arabic)) return arabic;
  const roman = parseRomanNumber(raw);
  if (roman !== null) return roman;
  const chinese = parseChineseNumber(raw);
  if (chinese !== null) return chinese;
  return null;
}

function normalizeUnit(rawUnit: string): UnitMatch | null {
  const u = String(rawUnit || '').trim();
  if (!u) return null;
  for (const rule of UNIT_RULES) {
    for (const p of rule.patterns) {
      if (p.test(u)) {
        return { raw: u, unit: rule.unit };
      }
    }
  }
  return null;
}

function getKeywordBoost(text: string, start: number) {
  const left = text.slice(Math.max(0, start - 6), start);
  for (const k of DURATION_KEYWORDS) {
    if (left.includes(k)) return 12;
  }
  return 0;
}

function getNoisePenalty(text: string, start: number) {
  const left = text.slice(Math.max(0, start - 6), start);
  if (/加重|加剧|恶化|加深|再发/u.test(left)) return 28;
  if (/间断|反复/u.test(left)) return 10;
  return 0;
}

function buildDurationCandidates(text: string): DurationCandidate[] {
  const normalized = normalizeText(text);
  const numPattern = String.raw`(?:\d+(?:\.\d+)?|[IVXLCDM]+|[零〇一二三四五六七八九十百千两半]+)`;
  const rangeSep = String.raw`(?:\s*(?:-|~|～|—|至|到)\s*)`;
  const unitPattern = String.raw`(?:分钟|分|小时|时|天|日|周|星期|月|年|min(?![a-zA-Z])|hr(?![a-zA-Z])|h(?![a-zA-Z])|d(?![a-zA-Z])|w(?![a-zA-Z])|m(?![a-zA-Z])|y(?![a-zA-Z]))`;
  const re = new RegExp(`(${numPattern})(?:${rangeSep}(${numPattern}))?\\s*(?:个\\s*)?(${unitPattern})`, 'giu');
  const out: DurationCandidate[] = [];

  for (const m of normalized.matchAll(re)) {
    const raw = String(m[0] || '');
    const a = String(m[1] || '');
    const b = String(m[2] || '');
    const unitRaw = String(m[3] || '');
    const idx = typeof m.index === 'number' ? m.index : normalized.indexOf(raw);
    if (idx < 0) continue;

    const unit = normalizeUnit(unitRaw)?.unit || null;
    if (!unit) continue;

    const v1 = parseNumberToken(a);
    if (v1 === null) continue;
    const v2 = b ? parseNumberToken(b) : null;
    const value: DurationValue = v2 !== null ? { min: Math.min(v1, v2), max: Math.max(v1, v2) } : v1;

    const end = idx + raw.length;
    const distanceToEnd = Math.max(0, normalized.length - end);
    const locScore = Math.max(0, 30 - Math.min(30, Math.floor(distanceToEnd / 2)));
    const rangeScore = typeof value === 'object' ? 10 : 0;
    const keywordBoost = getKeywordBoost(normalized, idx);
    const noisePenalty = getNoisePenalty(normalized, idx);
    const score = 60 + locScore + rangeScore + keywordBoost - noisePenalty;

    out.push({ start: idx, end, raw, value, unit, score });
  }

  return out;
}

function removeDurationSpan(text: string, span: { start: number; end: number }) {
  const left = text.slice(0, span.start);
  const right = text.slice(span.end);
  const merged = `${left} ${right}`;
  return normalizeWhitespace(
    merged
      .replace(/[，,。.;；:：（）()\[\]【】]/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

function normalizeComplaintText(text: string, synonyms?: Record<string, string>) {
  let t = String(text || '').trim();
  if (!t) return '';

  if (synonyms && typeof synonyms === 'object') {
    const entries = Object.entries(synonyms).filter(([k, v]) => k && v);
    entries.sort((a, b) => b[0].length - a[0].length);
    for (const [k, v] of entries) {
      if (t.includes(k)) t = t.split(k).join(v);
    }
  }

  t = t.replace(/疼(?!痛)/gu, '疼痛');
  t = t.replace(/不舒服/gu, '不适');
  t = normalizeWhitespace(
    t
      .replace(/(主诉|诉|因|以)[：:\s]*/gu, '')
      .replace(/^(近|约|已|持续|反复)\s*/gu, '')
      .replace(/\s+/gu, ' ')
  );

  return t;
}

function extractCoreSymptom(
  text: string,
  options?: { knownSymptoms?: string[]; synonyms?: Record<string, string> }
) {
  const t = normalizeComplaintText(text, options?.synonyms);
  if (!t) return '';

  const candidates: Array<{ idx: number; value: string; len: number }> = [];

  const known = Array.isArray(options?.knownSymptoms) ? options?.knownSymptoms : [];
  for (const name of known) {
    if (!name) continue;
    const idx = t.indexOf(name);
    if (idx >= 0) candidates.push({ idx, value: name, len: name.length });
  }

  if (options?.synonyms) {
    for (const [syn, standard] of Object.entries(options.synonyms)) {
      if (!syn || !standard) continue;
      const idx = t.indexOf(syn);
      if (idx >= 0) candidates.push({ idx, value: standard, len: syn.length });
    }
  }

  const rules: Array<{ re: RegExp; symptom: string }> = [
    { re: /(胸(口|部|前区)?).{0,3}(疼痛|疼|痛|闷|压榨|刺痛|绞痛|闷痛)/u, symptom: '胸痛' },
    { re: /(头|头部).{0,3}(疼痛|疼|痛)/u, symptom: '头痛' },
    { re: /(肚子|腹|上腹|下腹|右下腹|左下腹|胃).{0,3}(疼痛|疼|痛|胀痛|绞痛|隐痛|刺痛)/u, symptom: '腹痛' },
    { re: /(气促|呼吸困难|憋|喘)/u, symptom: '呼吸困难' },
    { re: /(心悸|心慌|心跳快|心跳|悸|慌)/u, symptom: '心悸' },
    { re: /(咳嗽|咳|咳痰|痰多|咳痰)/u, symptom: '咳嗽' },
    { re: /(发热|发烧|高热)/u, symptom: '发热' },
    { re: /(眩晕|头晕|天旋地转|晕)/u, symptom: '眩晕' },
    { re: /(腹泻|泻|稀便|水样便|里急后重)/u, symptom: '腹泻' },
    { re: /(呕吐|恶心|恶心呕吐)/u, symptom: '恶心呕吐' },
  ];
  for (const r of rules) {
    const m = t.match(r.re);
    if (m && typeof m.index === 'number') {
      candidates.push({ idx: m.index, value: r.symptom, len: m[0].length });
    }
  }

  if (candidates.length === 0) return t;
  candidates.sort((a, b) => a.idx - b.idx || b.len - a.len);
  return candidates[0].value;
}

function chooseBestCandidate(candidates: DurationCandidate[]) {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (c.score > best.score) best = c;
    else if (c.score === best.score && c.start > best.start) best = c;
  }
  return best;
}

export function parseChiefComplaintText(
  inputText: string,
  options?: { synonyms?: Record<string, string>; knownSymptoms?: string[] }
): ChiefComplaintParseResult {
  const raw = normalizeText(inputText);
  if (!raw) {
    return {
      complaint_text: '',
      duration_value: null,
      duration_unit: null,
      duration_raw: null,
      normalized_text: '',
      confidence: 0,
      failure_reason: '空文本',
    };
  }

  const candidates = buildDurationCandidates(raw);
  const best = chooseBestCandidate(candidates);

  if (!best) {
    const complaint = extractCoreSymptom(raw, { synonyms: options?.synonyms, knownSymptoms: options?.knownSymptoms });
    const confidence = complaint ? 0.62 : 0.2;
    return {
      complaint_text: complaint,
      duration_value: null,
      duration_unit: null,
      duration_raw: null,
      normalized_text: complaint,
      confidence: clamp01(confidence),
      failure_reason: '未识别到持续时间',
    };
  }

  const withoutDur = removeDurationSpan(raw, { start: best.start, end: best.end });
  const complaint = extractCoreSymptom(withoutDur, { synonyms: options?.synonyms, knownSymptoms: options?.knownSymptoms });
  const confidence =
    0.55 +
    (complaint ? 0.18 : -0.25) +
    0.22 +
    (typeof best.value === 'object' ? 0.03 : 0) +
    (best.unit === '天' || best.unit === '小时' ? 0.02 : 0);

  const durationText = typeof best.value === 'object'
    ? `${best.value.min}-${best.value.max}${best.unit}`
    : `${best.value}${best.unit}`;
  const normalized = normalizeWhitespace(`${complaint} ${durationText}`.trim());

  return {
    complaint_text: complaint,
    duration_value: best.value,
    duration_unit: best.unit,
    duration_raw: best.raw,
    normalized_text: normalized,
    confidence: clamp01(confidence),
    failure_reason: complaint ? null : '主诉核心描述为空',
  };
}

