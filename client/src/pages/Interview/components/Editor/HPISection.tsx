import React, { useEffect, useState, useRef } from 'react';
import { App as AntdApp, Form, Input, Radio, Checkbox, Row, Col, Typography, Card, Select, Collapse, Timeline, Button, Space, InputNumber, theme } from 'antd';
import LazyModal from '../../../../components/lazy/LazyModal';
import { ClockCircleOutlined, PlusOutlined, SyncOutlined, ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined } from '@ant-design/icons';
import api, { unwrapData, type ApiResponse } from '../../../../utils/api';
import { buildHpiNarrative } from '../../../../utils/narrative';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';

const { Title, Text } = Typography;
const { TextArea } = Input;
// 使用 Collapse items API，避免 rc-collapse children 未来移除带来的警告



const SeverityBlocks: React.FC<{ value?: string; onChange?: (v: string) => void }> = ({ value, onChange }) => {
  const current = String(value || '');
  const selectedCount = current === 'mild' ? 2 : current === 'moderate' ? 3 : current === 'severe' ? 5 : 0;
  const label = current === 'mild' ? '轻度' : current === 'moderate' ? '中度' : current === 'severe' ? '重度' : '未选择';
  const mapIdxToValue = (idx: number) => {
    if (idx <= 2) return 'mild';
    if (idx === 3) return 'moderate';
    return 'severe';
  };

  return (
    <div className="severity-blocks">
      <div className="severity-blocks-bar" role="radiogroup" aria-label="程度选择">
        {Array.from({ length: 5 }).map((_, i) => {
          const idx = i + 1;
          const active = idx <= selectedCount;
          const title = idx <= 2 ? '轻度' : idx === 3 ? '中度' : '重度';
          return (
            <button
              key={idx}
              type="button"
              className={`severity-block ${active ? 'active' : ''}`}
              title={title}
              onClick={() => onChange?.(mapIdxToValue(idx))}
            />
          );
        })}
      </div>
      <div className="severity-blocks-label">{label}</div>
    </div>
  );
};

/**
 * HPISection
 * 现病史编辑分节：包含起病、症状特点、伴随症状、诊治经过与一般情况
 */
const HPISection: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { token } = theme.useToken();
  const form = Form.useFormInstance();
  const mappingQuery = useQuery({
    queryKey: ['mapping', 'symptoms'],
    queryFn: async () => {
      type MappingPayload = { synonyms: Record<string, string>; nameToKey: Record<string, string> };
      const res = await api.get('/mapping/symptoms') as ApiResponse<MappingPayload | { data: MappingPayload }>;
      return res;
    }
  });
  const mappingPayload = unwrapData<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>(mappingQuery.data as ApiResponse<{ synonyms: Record<string, string>; nameToKey: Record<string, string> }>);
  const symptomOptions = React.useMemo<{ label: string; value: string }[]>(() => {
    if (mappingQuery.data && (mappingQuery.data as ApiResponse<unknown>).success && mappingPayload && mappingPayload.nameToKey) {
      const opts = Object.entries(mappingPayload.nameToKey).map(([name, key]) => ({ label: name, value: key }));
      opts.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
      console.log('[HPI] 症状映射加载成功', { count: opts.length });
      return opts;
    }
    if (mappingQuery.isError) {
      console.error('[HPI] 症状映射接口异常', mappingQuery.error);
    }
    return [];
  }, [mappingQuery.data, mappingQuery.isError, mappingQuery.error, mappingPayload]);
  const labelByKey = React.useMemo<Record<string, string>>(
    () => Object.fromEntries(symptomOptions.map(opt => [opt.value, opt.label])),
    [symptomOptions]
  );
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addDate, setAddDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [addInstitution, setAddInstitution] = useState('');
  const [addTreatment, setAddTreatment] = useState('');
  
  // 标记用户是否手动修改过伴随症状描述，避免自动覆盖
  const userModifiedAssocSymptomsRef = useRef<boolean>(false);
  const userModifiedNarrativeRef = useRef<boolean>(false);
  const lastAutoNarrativeRef = useRef<string>('');
  // 记录上一次伴随症状的选择值
  const lastAssociatedSymptomsRef = useRef<string[]>([]);
  
  // 监听关键字段以驱动时间线和自动生成
  const onsetTime = Form.useWatch(['presentIllness', 'onsetTime'], form);
  const onsetMode = Form.useWatch(['presentIllness', 'onsetMode'], form);
  const trigger = Form.useWatch(['presentIllness', 'trigger'], form);
  const location = Form.useWatch(['presentIllness', 'location'], form);
  const quality = Form.useWatch(['presentIllness', 'quality'], form);
  const severity = Form.useWatch(['presentIllness', 'severity'], form);
  const durationDetails = Form.useWatch(['presentIllness', 'durationDetails'], form);
  const factors = Form.useWatch(['presentIllness', 'factors'], form);
  const negativeSymptoms = Form.useWatch(['presentIllness', 'negativeSymptoms'], form);
  const admissionDiagnosis = Form.useWatch(['presentIllness', 'admissionDiagnosis'], form);
  const spirit = Form.useWatch(['presentIllness', 'spirit'], form);
  const appetite = Form.useWatch(['presentIllness', 'appetite'], form);
  const sleep = Form.useWatch(['presentIllness', 'sleep'], form);
  const strength = Form.useWatch(['presentIllness', 'strength'], form);
  const weight = Form.useWatch(['presentIllness', 'weight'], form);
  const weight_change_jin = Form.useWatch(['presentIllness', 'weight_change_jin'], form);
  const urine_stool = Form.useWatch(['presentIllness', 'urine_stool'], form);
  const evolution = Form.useWatch(['presentIllness', 'hpi_evolution'], form);
  const legacyEvolution = Form.useWatch(['presentIllness', 'evolution'], form);
  const narrative = Form.useWatch(['presentIllness', 'narrative'], form);
  const narrativeSource = Form.useWatch(['presentIllness', 'narrativeSource'], form);

  const EMPTY_ARR = React.useMemo<string[]>(() => [], []);
  const associatedSymptoms = Form.useWatch(['presentIllness', 'associatedSymptoms'], form) || EMPTY_ARR;
  const associatedSymptomsDetails = Form.useWatch(['presentIllness', 'associatedSymptomsDetails'], form);
  const treatmentHistory = Form.useWatch(['presentIllness', 'treatmentHistory'], form);
  const treatmentHistoryUserOrdered = Form.useWatch(['presentIllness', 'treatmentHistoryUserOrdered'], form);

  /**
   * buildHpiNarrative
   * 根据各分项内容自动生成现病史段落
   */
  const handleBuildHpiNarrative = React.useCallback(() => {
    const values = {
      onsetTime, onsetMode, trigger, location, quality, severity, durationDetails, factors,
      associatedSymptoms, associatedSymptomsDetails, negativeSymptoms, treatmentHistory,
      admissionDiagnosis, spirit, appetite, sleep, strength, weight, weight_change_jin, urine_stool, hpi_evolution: evolution
    };
    
    const mainSymptom = form.getFieldValue(['chiefComplaint', 'symptom']) || '不适';
    return buildHpiNarrative(values, mainSymptom, labelByKey);
  }, [onsetTime, onsetMode, trigger, location, quality, severity, durationDetails, factors, associatedSymptoms, associatedSymptomsDetails, negativeSymptoms, treatmentHistory, admissionDiagnosis, spirit, appetite, sleep, strength, weight, weight_change_jin, urine_stool, evolution, labelByKey, form]);

  useEffect(() => {
    if ((!evolution || String(evolution).trim() === '') && legacyEvolution && String(legacyEvolution).trim() !== '') {
      form.setFieldValue(['presentIllness', 'hpi_evolution'], legacyEvolution);
    }
  }, [evolution, form, legacyEvolution]);

  useEffect(() => {
    const current = String(narrative || '').trimEnd();
    if (!current) return;
    const source = String(narrativeSource || '').trim();
    const normalizeForCompare = (text: unknown): string =>
      String(text ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trimEnd()
        .replace(/\s+/gu, '');

    if (source === 'manual') {
      userModifiedNarrativeRef.current = true;
      return;
    }

    if (!lastAutoNarrativeRef.current) {
      if (source === 'auto') {
        lastAutoNarrativeRef.current = current;
        console.log('[HPI] 识别到现病史叙述来源为自动草稿，将随字段变更联动更新');
      } else {
        const built = handleBuildHpiNarrative().trimEnd();
        if (built && normalizeForCompare(built) === normalizeForCompare(current)) {
          lastAutoNarrativeRef.current = current;
          form.setFieldValue(['presentIllness', 'narrativeSource'], 'auto');
          console.log('[HPI] 推断现病史叙述为自动草稿，将随字段变更联动更新');
        } else {
          const mainSymptom = form.getFieldValue(['chiefComplaint', 'symptom']) || '不适';
          const builtWithoutEvolution = buildHpiNarrative(
            {
              onsetTime,
              onsetMode,
              trigger,
              location,
              quality,
              severity,
              durationDetails,
              factors,
              associatedSymptoms,
              associatedSymptomsDetails,
              negativeSymptoms,
              treatmentHistory,
              admissionDiagnosis,
              spirit,
              appetite,
              sleep,
              strength,
              weight,
              weight_change_jin,
              urine_stool,
              hpi_evolution: '',
              evolution: '',
            },
            mainSymptom,
            labelByKey
          ).trimEnd();
          if (builtWithoutEvolution && normalizeForCompare(builtWithoutEvolution) === normalizeForCompare(current)) {
            lastAutoNarrativeRef.current = current;
            form.setFieldValue(['presentIllness', 'narrativeSource'], 'auto');
            console.log('[HPI] 推断现病史叙述为自动草稿（演变字段后补），将自动补齐更新');
          } else {
            userModifiedNarrativeRef.current = true;
            form.setFieldValue(['presentIllness', 'narrativeSource'], 'manual');
            console.log('[HPI] 识别到现病史叙述已被手动修改，后续不自动覆盖');
            return;
          }
        }
      }
    }

    if (normalizeForCompare(current) !== normalizeForCompare(lastAutoNarrativeRef.current)) return;
    const next = handleBuildHpiNarrative().trimEnd();
    if (!next || next === current) return;
    form.setFieldValue(['presentIllness', 'narrative'], next);
    lastAutoNarrativeRef.current = next;
    if (String(form.getFieldValue(['presentIllness', 'narrativeSource']) || '').trim() !== 'auto') {
      form.setFieldValue(['presentIllness', 'narrativeSource'], 'auto');
    }
    console.log('[HPI] 自动联动更新现病史叙述（字段变更）');
  }, [
    admissionDiagnosis,
    appetite,
    associatedSymptoms,
    associatedSymptomsDetails,
    durationDetails,
    evolution,
    factors,
    form,
    handleBuildHpiNarrative,
    legacyEvolution,
    location,
    narrative,
    negativeSymptoms,
    onsetMode,
    onsetTime,
    quality,
    severity,
    sleep,
    spirit,
    strength,
    treatmentHistory,
    trigger,
    urine_stool,
    weight,
    weight_change_jin,
    narrativeSource,
    labelByKey,
  ]);

  useEffect(() => {
    if (weight !== 'loss' && weight !== 'gain') {
      if (weight_change_jin !== undefined && weight_change_jin !== null && `${weight_change_jin}`.trim() !== '') {
        form.setFieldValue(['presentIllness', 'weight_change_jin'], undefined);
      }
    }
  }, [form, weight, weight_change_jin]);


  /**
   * 监听伴随症状描述的变化，检测用户是否手动修改
   */
  useEffect(() => {
    if (!associatedSymptomsDetails) return;
    
    const labels = associatedSymptoms.map((key: string) => labelByKey[key] || key);
    const autoDesc = associatedSymptoms.length > 0 ? `伴有${labels.join('、')}。` : '';
    
    // 如果当前描述与自动生成的描述不一致，说明用户手动修改过
    if (associatedSymptomsDetails !== autoDesc) {
      userModifiedAssocSymptomsRef.current = true;
      console.log('[HPISection] 检测到用户手动修改伴随症状描述', { 
        current: associatedSymptomsDetails, 
        autoGenerated: autoDesc 
      });
    }
  }, [associatedSymptomsDetails, associatedSymptoms, labelByKey]);

  /**
   * 自动生成伴随症状描述（仅在值变化或为空/自动格式时写入）
   */
  useEffect(() => {
    // 检查伴随症状选择是否发生变化
    const symptomsChanged = JSON.stringify(associatedSymptoms) !== JSON.stringify(lastAssociatedSymptomsRef.current);
    lastAssociatedSymptomsRef.current = associatedSymptoms;
    
    if (associatedSymptoms.length > 0) {
      const labels = associatedSymptoms.map((key: string) => labelByKey[key] || key);
      const autoDesc = `伴有${labels.join('、')}。`;
      const currentDesc = form.getFieldValue(['presentIllness', 'associatedSymptomsDetails']);
      
      // 只在伴随症状选择变化且用户未手动修改时，才自动更新描述
      if (symptomsChanged && !userModifiedAssocSymptomsRef.current && (!currentDesc || currentDesc === '')) {
        form.setFieldValue(['presentIllness', 'associatedSymptomsDetails'], autoDesc);
        console.log('[HPISection] 自动生成伴随症状描述', autoDesc);
      }
    } else {
      // 当没有选择伴随症状时，如果之前是自动生成的描述，则清空
      const currentDesc = form.getFieldValue(['presentIllness', 'associatedSymptomsDetails']);
      if (symptomsChanged && !userModifiedAssocSymptomsRef.current && currentDesc && currentDesc.startsWith('伴有')) {
        form.setFieldValue(['presentIllness', 'associatedSymptomsDetails'], '');
      }
    }
  }, [associatedSymptoms, form, labelByKey]);

  // 通过 React Query 自动拉取映射，无需在 effect 中手动 setState

  const normalizeTreatmentRecords = (input: unknown): string[] => {
    if (Array.isArray(input)) return input.map(x => String(x || '').trim()).filter(Boolean);
    const raw = String(input || '').trim();
    if (!raw) return [];
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const byNewline = normalized.split('\n').map(s => String(s || '').trim()).filter(Boolean);
    if (byNewline.length > 1) return byNewline;
    const single = byNewline[0] || '';
    const sep = single.includes(',') ? ',' : single.includes('，') ? '，' : '';
    if (!sep) return byNewline;
    return single.split(sep).map(s => String(s || '').trim()).filter(Boolean);
  };

  const treatmentRecords = normalizeTreatmentRecords(treatmentHistory);

  const treatments = (() => {
    const records = treatmentRecords;
    return records.map((line, idx) => {
      const match = line.match(/^\[(.*?)\]/u);
      const date = match ? String(match[1] || '').trim() : '';
      const content = match ? line.substring(match[0].length).trim() : line;
      return { date: date || `记录 ${idx + 1}`, content };
    });
  })();

  const [collapseActiveKeys, setUserExpandedKeys] = useState<string[]>([]);

  // 构建动态时间线数据
  const timelineItems = [
    { 
        title: onsetTime || '起病', 
        content: (
            <>
                <Text strong>起病</Text>
                <div>{trigger ? `诱因：${trigger}` : '无明显诱因'}</div>
                <div>{onsetMode === 'sudden' ? '起病急骤' : onsetMode === 'gradual' ? '起病缓慢' : ''}</div>
            </>
        ), 
        color: 'green' 
    },
    ...treatments.map((t) => ({
        title: t.date,
        content: <div style={{ whiteSpace: 'pre-wrap' }}>{t.content}</div>,
        color: 'blue'
    })),
    { title: '今日', content: <Text strong>就诊</Text>, color: 'gray' },
  ];

  /**
   * openAddTreatmentModal
   * 打开诊治节点添加弹窗，采集日期/机构/诊断/治疗信息
   */
  const openAddTreatmentModal = () => {
    setAddDate(dayjs().format('YYYY-MM-DD'));
    setAddInstitution('');
    setAddTreatment('');
    setAddModalOpen(true);
  };

  /**
   * confirmAddTreatment
   * 生成规范文本并追加至诊治记录，驱动时间线更新
   */
  const confirmAddTreatment = () => {
    const dateText = String(addDate || '').trim();
    const inst = String(addInstitution || '').trim();
    const treat = String(addTreatment || '').trim();
    const treatText = treat.replace(/^(治疗\/方案|治疗方案)[:：]\s*/u, '').trim();

    if (!dayjs(dateText, 'YYYY-MM-DD', true).isValid()) {
      message.error('日期格式必须为YYYY-MM-DD');
      return;
    }
    if (!inst) {
      message.error('医疗机构不能为空');
      return;
    }
    if (!treatText) {
      message.error('治疗方案不能为空');
      return;
    }

    const parts = [
      `于${inst}`,
      treatText,
    ]
      .filter(Boolean)
      .join('；')
      .replace(/\s+/gu, ' ');

    const entry = `[${dateText}] ${parts}`;

    const current = normalizeTreatmentRecords(form.getFieldValue(['presentIllness', 'treatmentHistory']));
    const userOrdered = Boolean(form.getFieldValue(['presentIllness', 'treatmentHistoryUserOrdered']));

    const parseTs = (line: string): number => {
      const m = String(line || '').match(/^\[(\d{4}-\d{2}-\d{2})\]/u);
      if (!m) return Number.POSITIVE_INFINITY;
      const t = dayjs(m[1], 'YYYY-MM-DD', true);
      return t.isValid() ? t.valueOf() : Number.POSITIVE_INFINITY;
    };

    const next = (() => {
      if (userOrdered) return [...current, entry];

      const ts = parseTs(entry);
      const out: string[] = [];
      let inserted = false;
      for (const it of current) {
        const its = parseTs(it);
        if (!inserted && ts < its) {
          out.push(entry);
          inserted = true;
        }
        out.push(it);
      }
      if (!inserted) out.push(entry);
      return out;
    })();

    form.setFieldValue(['presentIllness', 'treatmentHistory'], next.join(','));
    console.log('[HPI] 已添加诊治节点', { date: dateText, institution: inst, treatment: treat, userOrdered });
    setAddModalOpen(false);
  };

  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>现病史 (History of Present Illness)</Title>

      <Form.Item name={['presentIllness', 'treatmentHistory']} hidden>
        <Input />
      </Form.Item>
      <Form.Item name={['presentIllness', 'treatmentHistoryUserOrdered']} valuePropName="checked" hidden>
        <Checkbox />
      </Form.Item>
      <Form.Item name={['presentIllness', 'narrativeSource']} hidden>
        <Input />
      </Form.Item>
      
      {/* 0. 时间线视图 (可视化辅助) */}
      <Card type="inner" title="【病史时间线】" size="small" style={{ marginBottom: 24, background: token.colorSuccessBg, borderColor: token.colorSuccessBorder }}>
        <div style={{ padding: '20px 0 0 20px' }}>
            <Timeline mode="start" items={timelineItems} />
        </div>
      </Card>

      <Collapse 
        activeKey={collapseActiveKeys}
        onChange={(keys) => {
          const next = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).map(String);
          setUserExpandedKeys(next);
        }}
        expandIconPlacement="end"
        items={[
          {
            key: '1',
            label: <Text strong>1️⃣ 起病情况与患病时间</Text>,
            forceRender: true,
            children: (
              <div id="hpi-panel-1">
                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item name={['presentIllness', 'onsetMode']} label="起病形式">
                      <Radio.Group>
                        <Radio value="sudden">突然</Radio>
                        <Radio value="gradual">缓慢</Radio>
                      </Radio.Group>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['presentIllness', 'onsetTime']}
                      label="确切时间"
                      rules={[{ required: true, message: '请填写起病时间' }]}
                    >
                      <Input placeholder="如：2023年10月25日晨起时 / 5天前午饭后" prefix={<ClockCircleOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name={['presentIllness', 'trigger']} label="诱因/环境">
                      <Input placeholder="如：饮酒后、淋雨后、劳累后、情绪激动时" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            )
          },
          {
            key: '2',
            label: <Text strong>2️⃣ 主要症状的特点</Text>,
            forceRender: true,
            children: (
              <div id="hpi-panel-2">
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      name={['presentIllness', 'location']}
                      label="部位"
                      rules={[{ required: true, message: '请填写主要症状部位/特点' }]}
                    >
                      <Input placeholder="疼痛/不适具体部位，是否放射（可在此补充）" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['presentIllness', 'quality']} label="性质" initialValue={[]}>
                      <Select mode="tags" placeholder="选择或输入">
                        <Select.Option value="绞痛">绞痛</Select.Option>
                        <Select.Option value="钝痛">钝痛</Select.Option>
                        <Select.Option value="刺痛">刺痛</Select.Option>
                        <Select.Option value="胀痛">胀痛</Select.Option>
                        <Select.Option value="烧灼感">烧灼感</Select.Option>
                        <Select.Option value="闷痛">闷痛</Select.Option>
                        <Select.Option value="压榨感">压榨感</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['presentIllness', 'severity']} label="程度">
                      <SeverityBlocks />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['presentIllness', 'durationDetails']} label="持续时间/频率">
                      <Input placeholder="持续性/阵发性/间歇性，每次约多久、多久发作一次" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name={['presentIllness', 'factors']} label="加重或缓解因素">
                      <Input placeholder="如：活动/进食/呼吸加重；休息/体位/服药缓解" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            )
          },
          {
            key: '3',
            label: <Text strong>3️⃣ 病情的发展与演变</Text>,
            forceRender: true,
            children: (
              <div id="hpi-panel-3">
                <Form.Item
                  name={['presentIllness', 'hpi_evolution']}
                  label="变化过程"
                  rules={[{ required: true, message: '请描述病情发展与演变过程' }]}
                >
                  <TextArea
                    rows={4}
                    placeholder="按时间顺序描述：症状如何变化？逐渐加重/减轻？是否出现新症状？如：近2日疼痛加剧，并出现黑便。"
                  />
                </Form.Item>
              </div>
            )
          },
          {
            key: '4',
            label: <Text strong>4️⃣ 伴随症状（含重要阴性）</Text>,
            forceRender: true,
            children: (
              <div id="hpi-panel-4">
                <Form.Item name={['presentIllness', 'associatedSymptoms']} label="有无以下症状">
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Row gutter={[12, 12]}>
                      {symptomOptions.map(opt => (
                        <Col span={6} key={opt.value}>
                          <Checkbox value={opt.value}>{opt.label}</Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </Form.Item>
                <div style={{ background: token.colorInfoBg, padding: 12, borderRadius: 4, marginBottom: 16 }}>
                  <Space align="center" style={{ marginBottom: 8 }}>
                    <Text type="secondary">自动生成描述：</Text>
                    <Button
                      size="small"
                      icon={<SyncOutlined />}
                      type="link"
                      onClick={() => {
                        userModifiedAssocSymptomsRef.current = false;
                        form.setFieldValue(
                          ['presentIllness', 'associatedSymptomsDetails'],
                          associatedSymptoms.length > 0
                            ? `伴有${associatedSymptoms.map((key: string) => labelByKey[key] || key).join('、')}。`
                            : ''
                        );
                      }}
                    >
                      重新生成
                    </Button>
                  </Space>
                  <Form.Item name={['presentIllness', 'associatedSymptomsDetails']} noStyle>
                    <TextArea rows={2} placeholder="补充伴随症状特点（如：发热最高体温、呕吐次数、黄疸等）" />
                  </Form.Item>
                </div>
                <Form.Item name={['presentIllness', 'negativeSymptoms']} label="重要阴性（排除意义）">
                  <Input placeholder="如：无发热、无盗汗、无体重明显下降、无黄疸" />
                </Form.Item>
              </div>
            )
          },
          {
            key: '5',
            label: <Text strong>5️⃣ 诊疗经过</Text>,
            forceRender: true,
            children: (
              <div id="hpi-panel-5">
                <Form.Item label="诊治记录">
                  <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 6, padding: 12, background: token.colorFillAlter }}>
                    {treatmentRecords.length === 0 ? (
                      <Text type="secondary">未添加诊治记录</Text>
                    ) : (
                      <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                        {treatmentRecords.map((line, idx) => (
                          <div
                            key={`${idx}-${line}`}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                              padding: '8px 10px',
                              borderRadius: 6,
                              background: token.colorBgContainer,
                              border: `1px solid ${token.colorBorderSecondary}`,
                            }}
                          >
                            <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{line}</div>
                            <Space orientation="vertical" size={4}>
                              <Button
                                size="small"
                                icon={<ArrowUpOutlined />}
                                disabled={idx === 0}
                                onClick={() => {
                                  const next = [...treatmentRecords];
                                  const tmp = next[idx - 1];
                                  next[idx - 1] = next[idx];
                                  next[idx] = tmp;
                                  form.setFieldValue(['presentIllness', 'treatmentHistory'], next.join(','));
                                  form.setFieldValue(['presentIllness', 'treatmentHistoryUserOrdered'], true);
                                  console.log('[HPI] 诊治记录上移', { from: idx, to: idx - 1 });
                                }}
                              />
                              <Button
                                size="small"
                                icon={<ArrowDownOutlined />}
                                disabled={idx === treatmentRecords.length - 1}
                                onClick={() => {
                                  const next = [...treatmentRecords];
                                  const tmp = next[idx + 1];
                                  next[idx + 1] = next[idx];
                                  next[idx] = tmp;
                                  form.setFieldValue(['presentIllness', 'treatmentHistory'], next.join(','));
                                  form.setFieldValue(['presentIllness', 'treatmentHistoryUserOrdered'], true);
                                  console.log('[HPI] 诊治记录下移', { from: idx, to: idx + 1 });
                                }}
                              />
                              <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => {
                                  const next = treatmentRecords.filter((_, i) => i !== idx);
                                  form.setFieldValue(['presentIllness', 'treatmentHistory'], next.join(','));
                                  form.setFieldValue(['presentIllness', 'treatmentHistoryUserOrdered'], true);
                                  console.log('[HPI] 诊治记录删除', { idx });
                                }}
                              />
                            </Space>
                          </div>
                        ))}
                      </Space>
                    )}
                  </div>
                </Form.Item>
                <Space>
                  <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={openAddTreatmentModal}>
                    添加诊治节点
                  </Button>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {treatmentHistoryUserOrdered ? '已启用用户自定义顺序' : '默认按日期升序插入'}
                  </Text>
                </Space>
                <Form.Item name={['presentIllness', 'admissionDiagnosis']} label="就诊时诊断/拟诊" style={{ marginTop: 16 }}>
                  <Input placeholder="如：头晕头痛原因待查" />
                </Form.Item>
              </div>
            )
          },
          {
            key: '6',
            label: <Text strong>6️⃣ 发病以来一般情况</Text>,
            forceRender: true,
            children: (
              <div id="hpi-panel-6">
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['presentIllness', 'spirit']} label="精神">
                      <Radio.Group>
                        <Radio value="good">好</Radio>
                        <Radio value="normal">一般</Radio>
                        <Radio value="bad">差</Radio>
                      </Radio.Group>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['presentIllness', 'strength']} label="体力">
                      <Radio.Group>
                        <Radio value="正常">正常</Radio>
                        <Radio value="尚可">尚可</Radio>
                        <Radio value="减弱">减弱</Radio>
                      </Radio.Group>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['presentIllness', 'appetite']} label="食欲">
                      <Radio.Group>
                        <Radio value="normal">正常</Radio>
                        <Radio value="decreased">减退</Radio>
                        <Radio value="increased">增加</Radio>
                      </Radio.Group>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['presentIllness', 'sleep']} label="睡眠">
                      <Radio.Group>
                        <Radio value="normal">正常</Radio>
                        <Radio value="poor">差</Radio>
                      </Radio.Group>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['presentIllness', 'weight']} label="体重">
                      <Radio.Group>
                        <Radio value="no_change">无变化</Radio>
                        <Radio value="loss">下降</Radio>
                        <Radio value="gain">增加</Radio>
                      </Radio.Group>
                    </Form.Item>
                    {(weight === 'loss' || weight === 'gain') && (
                      <Form.Item name={['presentIllness', 'weight_change_jin']} label="变化斤数">
                        <InputNumber<number>
                          min={0}
                          precision={0}
                          placeholder={weight === 'loss' ? '如：下降了几斤' : '如：增加了几斤'}
                          style={{ width: '100%' }}
                          formatter={(v) => {
                            const t = String(v ?? '').trim();
                            if (!t) return '';
                            return t.endsWith('斤') ? t : `${t}斤`;
                          }}
                          parser={(v) => {
                            const t = String(v ?? '').replace(/斤/gu, '').trim();
                            const n = Number(t);
                            return Number.isFinite(n) ? n : 0;
                          }}
                        />
                      </Form.Item>
                    )}
                  </Col>
                  <Col span={24}>
                    <Form.Item name={['presentIllness', 'urine_stool']} label="大小便">
                      <Input placeholder="如：小便正常，大便黑便1次 / 腹泻3次/日" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            )
          }
        ]}
      />

      <Card
        type="inner"
        title="现病史叙述（自动生成/手动润色）"
        size="small"
        style={{ marginTop: 16, background: token.colorWarningBg, borderColor: token.colorWarningBorder }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">系统将按时间顺序整合上述内容生成段落，请在此基础上做最终润色。</Text>
          <Button
            type="link"
            size="small"
            onClick={() => {
              const draft = handleBuildHpiNarrative();
              form.setFieldValue(['presentIllness', 'narrative'], draft);
              form.setFieldValue(['presentIllness', 'narrativeSource'], 'auto');
              userModifiedNarrativeRef.current = false;
              lastAutoNarrativeRef.current = String(draft || '').trimEnd();
              console.log('[HPI] 自动生成现病史叙述', draft);
            }}
          >
            生成草稿
          </Button>
        </div>
        <Form.Item
          name={['presentIllness', 'narrative']}
          noStyle
          getValueFromEvent={(e) => {
            userModifiedNarrativeRef.current = true;
            form.setFieldValue(['presentIllness', 'narrativeSource'], 'manual');
            const v = e?.target?.value;
            if (typeof v === 'string') console.log('[HPI] 手动修改现病史叙述', { length: v.length });
            return v;
          }}
        >
          <TextArea
            rows={6}
            placeholder={`  患者【具体时间】前，在【诱因】后【急/缓】性起病，初起表现为【核心症状+核心特点】。【按时间顺序叙述演变】：随后（或【某个时间点】后），病情逐渐【加重/减轻】，并出现【伴随症状】。曾于【时间】在【地点】就诊，予【具体治疗】（或行【检查】，结果示：【关键结果】），但症状【缓解情况】。为求进一步诊治，遂来我院就诊。门诊以“[***]”收入我科\n  发病以来，患者精神【状态】、食欲【变化】、睡眠【影响】、大小便【情况】、体重【有无明显变化】。`}
          />
        </Form.Item>
      </Card>
      <LazyModal
        title="添加诊治节点"
        open={addModalOpen}
        onOk={confirmAddTreatment}
        onCancel={() => setAddModalOpen(false)}
        okText="添加"
        cancelText="取消"
      >
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="日期">
              <Input value={addDate} onChange={(e) => setAddDate(e.target.value)} placeholder="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="机构/科室">
              <Input value={addInstitution} onChange={(e) => setAddInstitution(e.target.value)} placeholder="如：xx医院内科" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="治疗方案/疗效">
          <TextArea rows={2} value={addTreatment} onChange={(e) => setAddTreatment(e.target.value)} placeholder="如：予止痛、抗感染治疗，症状好转..." />
        </Form.Item>
      </LazyModal>
    </div>
  );
};

export default HPISection;
