import React, { useEffect } from 'react';
import { Form, Input, Radio, Checkbox, Row, Col, Typography, Card, Select, Collapse, Timeline, Button, Space } from 'antd';
import { ClockCircleOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
// 使用 Collapse items API，避免 rc-collapse children 未来移除带来的警告

// 伴随症状选项 (Key 需与后端及 Session.tsx 保持一致)
const SYMPTOMS_OPTIONS = [
    { label: '发热', value: 'fever' },
    { label: '畏寒/寒战', value: 'chills' },
    { label: '出汗', value: 'sweating' },
    { label: '消瘦（体重下降）', value: 'weight_loss' },
    { label: '恶心与呕吐', value: 'nausea' },
    { label: '腹泻', value: 'diarrhea' },
    { label: '咳嗽', value: 'cough' },
    { label: '咳痰', value: 'sputum' },
    { label: '胸痛', value: 'chest_pain' },
    { label: '头痛', value: 'headache' },
    { label: '眩晕', value: 'dizziness' },
    { label: '心悸', value: 'palpitation' },
    { label: '呼吸困难', value: 'dyspnea' },
    { label: '水肿', value: 'edema' },
    { label: '皮疹', value: 'rash' },
    { label: '关节痛', value: 'joint_pain' },
    { label: '咯血', value: 'hemoptysis' },
    { label: '上消化道出血', value: 'hematemesis' },
];

const HPI_KEY_TO_LABEL: Record<string, string> = {};
SYMPTOMS_OPTIONS.forEach(opt => HPI_KEY_TO_LABEL[opt.value] = opt.label);

/**
 * HPISection
 * 现病史编辑分节：包含起病、症状特点、伴随症状、诊治经过与一般情况
 */
const HPISection: React.FC = () => {
  const form = Form.useFormInstance();
  
  // 监听关键字段以驱动时间线和自动生成
  const onsetTime = Form.useWatch(['presentIllness', 'onsetTime'], form);
  const onsetMode = Form.useWatch(['presentIllness', 'onsetMode'], form);
  const trigger = Form.useWatch(['presentIllness', 'trigger'], form);
  const EMPTY_ARR = React.useMemo<string[]>(() => [], []);
  const associatedSymptoms = Form.useWatch(['presentIllness', 'associatedSymptoms'], form) || EMPTY_ARR;
  const treatmentHistory = Form.useWatch(['presentIllness', 'treatmentHistory'], form);

  /**
   * 自动生成伴随症状描述（仅在值变化或为空/自动格式时写入）
   */
  useEffect(() => {
    if (associatedSymptoms.length > 0) {
        const labels = associatedSymptoms.map((key: string) => HPI_KEY_TO_LABEL[key] || key);
        const autoDesc = `伴有${labels.join('、')}。`;
        
        // 仅当描述为空或看起来是自动生成的格式时更新
        const currentDesc = form.getFieldValue(['presentIllness', 'associatedSymptomsDetails']);
        if ((!currentDesc || currentDesc.startsWith('伴有')) && currentDesc !== autoDesc) {
            form.setFieldValue(['presentIllness', 'associatedSymptomsDetails'], autoDesc);
        }
    }
  }, [associatedSymptoms, form]);

  // 解析诊治经过文本以生成时间线节点 (简单按行解析)
  const parseTreatments = (text: string) => {
      if (!text) return [];
      return text.split('\n').filter(line => line.trim()).map((line, idx) => {
          // 尝试提取日期 [xxx]
          const match = line.match(/^\[(.*?)\]/);
          const date = match ? match[1] : '记录 ' + (idx + 1);
          const content = match ? line.substring(match[0].length).trim() : line;
          return { date, content };
      });
  };

  const treatments = parseTreatments(treatmentHistory);

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

  const handleAddTreatment = () => {
      // 弹窗或直接追加文本
      const current = form.getFieldValue(['presentIllness', 'treatmentHistory']) || '';
      const newEntry = `[近日] 于xx医院检查...`;
      form.setFieldValue(['presentIllness', 'treatmentHistory'], current ? current + '\n' + newEntry : newEntry);
  };

  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>现病史 (History of Present Illness)</Title>
      
      {/* 0. 时间线视图 (可视化辅助) */}
      <Card type="inner" title="【病史时间线】" size="small" style={{ marginBottom: 24, background: '#f6ffed', borderColor: '#b7eb8f' }}>
        <div style={{ padding: '20px 0 0 20px' }}>
            <Timeline mode="start" items={timelineItems} />
        </div>
      </Card>

      <Collapse 
        defaultActiveKey={['1', '2', '3']} 
        expandIconPlacement="end"
        items={[
          {
            key: '1',
            label: <Text strong>1️⃣ 起病情况</Text>,
            children: (
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
                  <Form.Item name={['presentIllness', 'onsetTime']} label="确切时间">
                    <Input placeholder="如：5天前午饭后" prefix={<ClockCircleOutlined />} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={['presentIllness', 'trigger']} label="诱因">
                    <Input placeholder="如：受凉、饮食不洁" />
                  </Form.Item>
                </Col>
              </Row>
            )
          },
          {
            key: '2',
            label: <Text strong>2️⃣ 症状特点</Text>,
            children: (
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name={['presentIllness', 'location']} label="部位">
                    <Input placeholder="疼痛/不适具体部位" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name={['presentIllness', 'quality']} label="性质">
                    <Select mode="tags" placeholder="选择或输入">
                      <Select.Option value="绞痛">绞痛</Select.Option>
                      <Select.Option value="钝痛">钝痛</Select.Option>
                      <Select.Option value="刺痛">刺痛</Select.Option>
                      <Select.Option value="胀痛">胀痛</Select.Option>
                      <Select.Option value="烧灼感">烧灼感</Select.Option>
                      <Select.Option value="压榨感">压榨感</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name={['presentIllness', 'severity']} label="程度">
                    <Radio.Group>
                      <Radio value="mild">轻度</Radio>
                      <Radio value="moderate">中度</Radio>
                      <Radio value="severe">重度</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name={['presentIllness', 'durationDetails']} label="持续时间/频率">
                    <Input placeholder="持续性/阵发性" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name={['presentIllness', 'factors']} label="缓解/加重因素">
                    <Input placeholder="如：进食后加重，休息后缓解" />
                  </Form.Item>
                </Col>
              </Row>
            )
          },
          {
            key: '3',
            label: <Text strong>3️⃣ 伴随症状 (智能关联)</Text>,
            children: (
              <>
                <Form.Item name={['presentIllness', 'associatedSymptoms']} label="有无以下症状">
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Row gutter={[12, 12]}>
                      {SYMPTOMS_OPTIONS.map(opt => (
                        <Col span={6} key={opt.value}>
                          <Checkbox value={opt.value}>{opt.label}</Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </Form.Item>
                <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 4, marginBottom: 16 }}>
                  <Space align="center" style={{ marginBottom: 8 }}>
                    <Text type="secondary">自动生成描述：</Text>
                    <Button
                      size="small"
                      icon={<SyncOutlined />}
                      type="link"
                      onClick={() =>
                        form.setFieldValue(
                          ['presentIllness', 'associatedSymptomsDetails'],
                          `伴有${associatedSymptoms.join('、')}。`
                        )
                      }
                    >
                      重新生成
                    </Button>
                  </Space>
                  <Form.Item name={['presentIllness', 'associatedSymptomsDetails']} noStyle>
                    <TextArea rows={2} placeholder="描述伴随症状的特点..." />
                  </Form.Item>
                </div>
                <Form.Item name={['presentIllness', 'negativeSymptoms']} label="阴性症状 (重要阴性体征)">
                  <Input placeholder="如：无发热、无盗汗、无体重减轻" />
                </Form.Item>
              </>
            )
          },
          {
            key: '4',
            label: <Text strong>4️⃣ 诊治经过</Text>,
            children: (
              <>
                <Form.Item name={['presentIllness', 'treatmentHistory']} label="诊治记录">
                  <TextArea rows={4} placeholder="格式建议：&#10;1. 时间 + 地点 + 检查结果&#10;2. 诊断 + 治疗方案 + 疗效" />
                </Form.Item>
                <Space>
                  <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAddTreatment}>
                    添加节点 (模拟)
                  </Button>
                  <Text type="secondary" style={{ fontSize: 12 }}>* 添加节点将更新上方时间线视图</Text>
                </Space>
              </>
            )
          },
          {
            key: '5',
            label: <Text strong>5️⃣ 一般情况</Text>,
            children: (
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
                  <Form.Item name={['presentIllness', 'weight']} label="体重变化">
                    <Radio.Group>
                      <Radio value="no_change">无变化</Radio>
                      <Radio value="loss">下降</Radio>
                      <Radio value="gain">增加</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name={['presentIllness', 'urine_stool']} label="二便情况">
                    <Input placeholder="正常 / 异常描述" />
                  </Form.Item>
                </Col>
              </Row>
            )
          }
        ]}
      />
    </div>
  );
};

export default HPISection;
