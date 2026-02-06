import { SYMPTOM_NAME_TO_KEY, SYMPTOM_SYNONYMS } from '../services/mapping.service';
import { parseChiefComplaintText, type DurationUnit, type DurationValue } from '../services/chiefComplaintParser';
import fs from 'fs';

type Expected = {
  complaint_text: string;
  duration_value: DurationValue | null;
  duration_unit: DurationUnit | null;
};

type TestCase = {
  id: string;
  text: string;
  expected: Expected;
};

type EvalSummary = {
  total: number;
  exact_all: { correct: number; accuracy: number };
  complaint_text: { correct: number; accuracy: number };
  duration_unit: { correct: number; accuracy: number };
  duration_value: { correct: number; accuracy: number };
  duration_detection: { precision: number; recall: number; f1: number };
  latency_ms: { avg: number; p50: number; p90: number; p95: number; p99: number; max: number };
};

function percent(n: number, d: number) {
  if (!d) {return 0;}
  return (n / d) * 100;
}

function isRange(v: DurationValue | null): v is { min: number; max: number } {
  return Boolean(v && typeof v === 'object');
}

function equalDurationValue(a: DurationValue | null, b: DurationValue | null) {
  if (a === null && b === null) {return true;}
  if (a === null || b === null) {return false;}
  if (typeof a === 'number' && typeof b === 'number') {return a === b;}
  if (isRange(a) && isRange(b)) {return a.min === b.min && a.max === b.max;}
  return false;
}

function makeId(prefix: string, n: number) {
  return `${prefix}_${String(n).padStart(4, '0')}`;
}

function roman(n: number) {
  const map: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let v = n;
  let out = '';
  for (const [k, s] of map) {
    while (v >= k) {
      out += s;
      v -= k;
    }
  }
  return out;
}

function chinese(n: number) {
  const digit = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n < 10) {return digit[n] || String(n);}
  if (n === 10) {return '十';}
  if (n < 20) {return `十${digit[n - 10]}`;}
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${digit[tens]}十${ones ? digit[ones] : ''}`;
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) {return 0;}
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function makeCases(): TestCase[] {
  const knownSymptoms = Object.keys(SYMPTOM_NAME_TO_KEY);
  const symptomVariants: Array<{ canonical: string; phrases: string[] }> = [
    { canonical: '胸痛', phrases: ['胸痛', '胸口疼', '胸部疼痛', '胸口痛'] },
    { canonical: '腹痛', phrases: ['腹痛', '肚子疼', '胃痛', '上腹痛', '右下腹痛'] },
    { canonical: '头痛', phrases: ['头痛', '偏头痛', '神经性头痛', '头疼'] },
    { canonical: '眩晕', phrases: ['眩晕', '头晕', '天旋地转', '晕'] },
    { canonical: '发热', phrases: ['发热', '发烧', '高热'] },
    { canonical: '咳嗽', phrases: ['咳嗽', '咳痰', '痰多', '咳'] },
    { canonical: '呼吸困难', phrases: ['呼吸困难', '气促', '喘', '憋'] },
    { canonical: '心悸', phrases: ['心悸', '心慌', '心跳快', '慌'] },
    { canonical: '腹泻', phrases: ['腹泻', '泻', '稀便', '水样便'] },
    { canonical: '恶心呕吐', phrases: ['恶心呕吐', '恶心与呕吐', '呕吐伴恶心', '恶心后呕吐', '呕吐'] },
  ];

  const unitForms: Array<{ unit: DurationUnit; forms: string[] }> = [
    { unit: '分钟', forms: ['分钟', '分', 'min'] },
    { unit: '小时', forms: ['小时', '时', 'h'] },
    { unit: '天', forms: ['天', '日', 'd'] },
    { unit: '周', forms: ['周', '星期', 'w'] },
    { unit: '月', forms: ['月', '个月', 'm'] },
    { unit: '年', forms: ['年', '年', 'y'] },
  ];

  const numForms = [
    { value: 1, forms: ['1', '一', roman(1)] },
    { value: 2, forms: ['2', '二', roman(2)] },
    { value: 3, forms: ['3', '三', roman(3)] },
    { value: 7, forms: ['7', '七', roman(7)] },
    { value: 10, forms: ['10', '十', roman(10)] },
    { value: 12, forms: ['12', chinese(12), roman(12)] },
  ];

  const rangeSeps = ['-', '～', '至'];

  const out: TestCase[] = [];
  let idx = 1;

  for (const s of symptomVariants) {
    for (const phrase of s.phrases) {
      for (const u of unitForms) {
        for (const nf of numForms) {
          const nRaw = nf.forms[0];
          const unitRaw = u.forms[0];
          out.push({
            id: makeId('single', idx++),
            text: `${phrase}${nRaw}${unitRaw}`,
            expected: { complaint_text: s.canonical, duration_value: nf.value, duration_unit: u.unit },
          });
          out.push({
            id: makeId('kw', idx++),
            text: `近${phrase}${nf.forms[1]}${u.forms[1]}`,
            expected: { complaint_text: s.canonical, duration_value: nf.value, duration_unit: u.unit },
          });
          out.push({
            id: makeId('space', idx++),
            text: `${phrase} ${nf.forms[2]} ${u.forms[2]}`,
            expected: { complaint_text: s.canonical, duration_value: nf.value, duration_unit: u.unit },
          });
        }

        const r1 = numForms[1];
        const r2 = numForms[2];
        for (const sep of rangeSeps) {
          out.push({
            id: makeId('range', idx++),
            text: `${phrase}${r1.forms[0]}${sep}${r2.forms[0]}${u.forms[0]}`,
            expected: {
              complaint_text: s.canonical,
              duration_value: { min: r1.value, max: r2.value },
              duration_unit: u.unit,
            },
          });
          out.push({
            id: makeId('range_mix', idx++),
            text: `${phrase}${r1.forms[1]}${sep}${r2.forms[2]}${u.forms[2]}`,
            expected: {
              complaint_text: s.canonical,
              duration_value: { min: r1.value, max: r2.value },
              duration_unit: u.unit,
            },
          });
        }
      }
    }
  }

  const edge: TestCase[] = [
    { id: makeId('edge', idx++), text: '主诉：胸口疼III天', expected: { complaint_text: '胸痛', duration_value: 3, duration_unit: '天' } },
    { id: makeId('edge', idx++), text: '因头疼2-III天来诊', expected: { complaint_text: '头痛', duration_value: { min: 2, max: 3 }, duration_unit: '天' } },
    { id: makeId('edge', idx++), text: '反复头晕头痛3年，加重2天', expected: { complaint_text: '眩晕', duration_value: 3, duration_unit: '年' } },
    { id: makeId('edge', idx++), text: '发热伴咳嗽三天', expected: { complaint_text: '发热', duration_value: 3, duration_unit: '天' } },
    { id: makeId('edge', idx++), text: '恶心与呕吐2小时', expected: { complaint_text: '恶心呕吐', duration_value: 2, duration_unit: '小时' } },
  ];

  out.push(...edge);

  const cap = 240;
  const truncated = out.slice(0, cap);
  for (let i = 0; i < truncated.length; i += 1) {
    const c = truncated[i];
    const exists = knownSymptoms.includes(c.expected.complaint_text);
    if (!exists) {
      truncated[i] = {
        ...c,
        expected: { ...c.expected, complaint_text: c.expected.complaint_text },
      };
    }
  }
  return truncated;
}

function loadFromJson(filePath: string): TestCase[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {throw new Error('JSON 必须为数组');}
  return parsed as TestCase[];
}

function main() {
  const args = process.argv.slice(2);
  const jsonPath = args.find((a) => a.startsWith('--cases='))?.slice('--cases='.length);
  const outPath = args.find((a) => a.startsWith('--out='))?.slice('--out='.length);
  const cases = jsonPath ? loadFromJson(jsonPath) : makeCases();

  const knownSymptoms = Object.keys(SYMPTOM_NAME_TO_KEY);
  const latencies: number[] = [];

  let exactAll = 0;
  let correctComplaint = 0;
  let correctUnit = 0;
  let correctValue = 0;

  let tpDetect = 0;
  let fpDetect = 0;
  let fnDetect = 0;

  const failures: Array<{ id: string; text: string; expected: Expected; got: unknown }> = [];

  for (const c of cases) {
    const t0 = process.hrtime.bigint();
    const got = parseChiefComplaintText(c.text, { synonyms: SYMPTOM_SYNONYMS, knownSymptoms });
    const t1 = process.hrtime.bigint();
    const ms = Number(t1 - t0) / 1_000_000;
    latencies.push(ms);

    const complaintOk = String(got.complaint_text || '') === String(c.expected.complaint_text || '');
    const unitOk = (got.duration_unit || null) === (c.expected.duration_unit || null);
    const valueOk = equalDurationValue(got.duration_value, c.expected.duration_value);

    if (complaintOk) {correctComplaint += 1;}
    if (unitOk) {correctUnit += 1;}
    if (valueOk) {correctValue += 1;}

    const expectedHasDur = Boolean(c.expected.duration_unit && c.expected.duration_value !== null);
    const gotHasDur = Boolean(got.duration_unit && got.duration_value !== null);
    if (expectedHasDur && gotHasDur) {tpDetect += 1;}
    else if (!expectedHasDur && gotHasDur) {fpDetect += 1;}
    else if (expectedHasDur && !gotHasDur) {fnDetect += 1;}

    if (complaintOk && unitOk && valueOk) {
      exactAll += 1;
    } else {
      failures.push({ id: c.id, text: c.text, expected: c.expected, got });
    }
  }

  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((s, v) => s + v, 0) / (latencies.length || 1);
  const p = (x: number) => percentile(latencies, x);
  const precision = tpDetect / (tpDetect + fpDetect || 1);
  const recall = tpDetect / (tpDetect + fnDetect || 1);
  const f1 = (2 * precision * recall) / (precision + recall || 1);

  const summary: EvalSummary = {
    total: cases.length,
    exact_all: { correct: exactAll, accuracy: percent(exactAll, cases.length) },
    complaint_text: { correct: correctComplaint, accuracy: percent(correctComplaint, cases.length) },
    duration_unit: { correct: correctUnit, accuracy: percent(correctUnit, cases.length) },
    duration_value: { correct: correctValue, accuracy: percent(correctValue, cases.length) },
    duration_detection: { precision: percent(precision, 1), recall: percent(recall, 1), f1: percent(f1, 1) },
    latency_ms: { avg, p50: p(50), p90: p(90), p95: p(95), p99: p(99), max: latencies[latencies.length - 1] || 0 },
  };

  const report = { summary, failures: failures.slice(0, 50) };
  const outText = JSON.stringify(report, null, 2);
  if (outPath) {
    fs.writeFileSync(outPath, outText, 'utf-8');
  }

  console.log(outText);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main();

