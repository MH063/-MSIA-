import React, { useEffect } from 'react';
import { Form, Input, Radio, Typography, Card, Row, Col, InputNumber, Statistic, Space } from 'antd';

const { Title } = Typography;
const { TextArea } = Input;

const PersonalHistorySection: React.FC = () => {
  const form = Form.useFormInstance();
  
  // 监听吸烟相关字段
  const smokingStatus = Form.useWatch(['personalHistory', 'smoking_status'], form);
  const cigarettesPerDay = Form.useWatch(['personalHistory', 'cigarettesPerDay'], form);
  const smokingYears = Form.useWatch(['personalHistory', 'smokingYears'], form);
  
  // 监听饮酒相关字段
  const alcoholStatus = Form.useWatch(['personalHistory', 'alcohol_status'], form);
  const drinkVolume = Form.useWatch(['personalHistory', 'drinkVolume'], form); // ml
  const alcoholDegree = Form.useWatch(['personalHistory', 'alcoholDegree'], form); // %
  const drinkFreqPerWeek = Form.useWatch(['personalHistory', 'drinkFreqPerWeek'], form); // 次/周
  
  /**
   * 自动计算吸烟指数并同步到 smokingHistory（仅在值变化时写入）
   */
  useEffect(() => {
    let result = smokingStatus;
    let index = 0;
    
    if ((smokingStatus === '吸烟' || smokingStatus === '已戒烟') && cigarettesPerDay && smokingYears) {
        index = cigarettesPerDay * smokingYears;
        result += `，${cigarettesPerDay}支/日 × ${smokingYears}年，吸烟指数 ${index}。`;
        if (smokingStatus === '已戒烟') {
            const quitYears = form.getFieldValue(['personalHistory', 'quitSmokingYears']);
            if (quitYears) result += `已戒烟${quitYears}年。`;
        }
    } else if (smokingStatus === '从不') {
        result = '从不吸烟。';
    }
    
    if (result) {
        const prevText = form.getFieldValue(['personalHistory', 'smokingHistory']);
        const prevIndex = form.getFieldValue(['personalHistory', 'smokingIndex']);
        if (prevText !== result) {
          form.setFieldValue(['personalHistory', 'smokingHistory'], result);
        }
        if (prevIndex !== index) {
          form.setFieldValue(['personalHistory', 'smokingIndex'], index); // 仅供UI显示或临时存储
        }
    }
  }, [smokingStatus, cigarettesPerDay, smokingYears, form]);

  /**
   * 自动计算饮酒量与每周总量并同步到 drinkingHistory/weeklyAlcoholGrams（仅在值变化时写入）
   */
  useEffect(() => {
    let result = alcoholStatus;
    
    if ((alcoholStatus === '饮酒' || alcoholStatus === '已戒酒') && drinkVolume && alcoholDegree) {
        const gramsNum = (drinkVolume * (alcoholDegree / 100) * 0.8);
        const grams = gramsNum.toFixed(1);
        const weekly = typeof drinkFreqPerWeek === 'number' && drinkFreqPerWeek > 0 ? (gramsNum * drinkFreqPerWeek).toFixed(1) : undefined;
        result += `，每次${drinkVolume}ml (${alcoholDegree}%)，折合酒精量 ${grams}g${weekly ? `；每周约 ${weekly}g` : ''}。`;
        if (alcoholStatus === '已戒酒') {
            const quitYears = form.getFieldValue(['personalHistory', 'quitDrinkingYears']);
            if (quitYears) result += `已戒酒${quitYears}年。`;
        }
    } else if (alcoholStatus === '从不') {
        result = '从不饮酒。';
    }
    
    if (result) {
        const prevText = form.getFieldValue(['personalHistory', 'drinkingHistory']);
        if (prevText !== result) {
          form.setFieldValue(['personalHistory', 'drinkingHistory'], result);
        }
        // 存储每次与每周的估算负荷，便于助手面板提示
        const gramsNum = (drinkVolume && alcoholDegree) ? (drinkVolume * (alcoholDegree / 100) * 0.8) : 0;
        const weekly = typeof drinkFreqPerWeek === 'number' && drinkFreqPerWeek > 0 ? (gramsNum * drinkFreqPerWeek) : 0;
        const weeklyVal = Number.isFinite(weekly) ? Number(weekly.toFixed(1)) : 0;
        const prevWeekly = form.getFieldValue(['personalHistory', 'weeklyAlcoholGrams']);
        if (prevWeekly !== weeklyVal) {
          form.setFieldValue(['personalHistory', 'weeklyAlcoholGrams'], weeklyVal);
        }
    }
  }, [alcoholStatus, drinkVolume, alcoholDegree, drinkFreqPerWeek, form]);

  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>个人史 (Personal History)</Title>
      
      {/* 隐藏字段，存储最终生成的字符串 */}
      <Form.Item name={['personalHistory', 'smokingHistory']} hidden><Input /></Form.Item>
      <Form.Item name={['personalHistory', 'drinkingHistory']} hidden><Input /></Form.Item>
      
      <Card type="inner" title="1. 社会经历与职业" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
            <Col span={12}>
                <Form.Item name="occupation" label="职业">
                    <Input placeholder="患者职业" />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="employer" label="工作单位">
                    <Input placeholder="工作单位" />
                </Form.Item>
            </Col>
        </Row>
        <Form.Item name={['personalHistory', 'social']} label="社会经历">
            <TextArea rows={2} placeholder="出生地、居住地变迁、受教育程度等" />
        </Form.Item>
        <Form.Item name={['personalHistory', 'work_cond']} label="工作环境/接触史">
            <TextArea rows={2} placeholder="粉尘、毒物、放射性物质接触史等" />
        </Form.Item>
      </Card>

      <Card type="inner" title="2. 习惯与嗜好 (自动计算)" size="small" style={{ marginBottom: 24 }}>
          {/* 吸烟史计算器 */}
          <div style={{ background: '#fff7e6', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #ffe7ba' }}>
            <Row gutter={16} align="middle">
                <Col span={6}>
                    <Form.Item name={['personalHistory', 'smoking_status']} label="吸烟史" initialValue="从不" style={{ marginBottom: 0 }}>
                        <Radio.Group buttonStyle="solid">
                            <Radio.Button value="从不">从不</Radio.Button>
                            <Radio.Button value="已戒烟">戒烟</Radio.Button>
                            <Radio.Button value="吸烟">吸烟</Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                </Col>
                
                {(smokingStatus === '吸烟' || smokingStatus === '已戒烟') && (
                    <>
                        <Col span={6}>
                            <Form.Item name={['personalHistory', 'cigarettesPerDay']} label="每日吸烟(支)" style={{ marginBottom: 0 }}>
                                <InputNumber min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name={['personalHistory', 'smokingYears']} label="烟龄(年)" style={{ marginBottom: 0 }}>
                                <InputNumber min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                             <Statistic 
                                title="吸烟指数" 
                                value={form.getFieldValue(['personalHistory', 'smokingIndex']) || 0} 
                                suffix="年支" 
                                valueStyle={{ fontSize: 16, color: '#fa8c16' }}
                             />
                        </Col>
                        {smokingStatus === '已戒烟' && (
                             <Col span={24} style={{ marginTop: 12 }}>
                                 <Form.Item name={['personalHistory', 'quitSmokingYears']} label="已戒烟年数">
                                     <Space.Compact>
                                       <InputNumber min={0} />
                                       <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0' }}>年</span>
                                     </Space.Compact>
                                 </Form.Item>
                             </Col>
                        )}
                    </>
                )}
            </Row>
          </div>

          {/* 饮酒史计算器 */}
          <div style={{ background: '#f0f5ff', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #adc6ff' }}>
            <Row gutter={16} align="middle">
                <Col span={6}>
                    <Form.Item name={['personalHistory', 'alcohol_status']} label="饮酒史" initialValue="从不" style={{ marginBottom: 0 }}>
                        <Radio.Group buttonStyle="solid">
                            <Radio.Button value="从不">从不</Radio.Button>
                            <Radio.Button value="已戒酒">戒酒</Radio.Button>
                            <Radio.Button value="饮酒">饮酒</Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                </Col>
                
                {(alcoholStatus === '饮酒' || alcoholStatus === '已戒酒') && (
                    <>
                        <Col span={6}>
                            <Form.Item name={['personalHistory', 'drinkVolume']} label="日饮量(ml)" style={{ marginBottom: 0 }}>
                                <InputNumber min={0} step={50} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name={['personalHistory', 'alcoholDegree']} label="度数(%)" style={{ marginBottom: 0 }}>
                                <InputNumber min={0} max={100} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name={['personalHistory', 'drinkFreqPerWeek']} label="频率(次/周)" style={{ marginBottom: 0 }}>
                                <InputNumber min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={24} style={{ marginTop: 12 }}>
                            <Statistic 
                                title="每周估算酒精量" 
                                value={form.getFieldValue(['personalHistory', 'weeklyAlcoholGrams']) || 0} 
                                suffix="g" 
                                valueStyle={{ fontSize: 16, color: '#2f54eb' }}
                            />
                        </Col>
                         {alcoholStatus === '已戒酒' && (
                             <Col span={24} style={{ marginTop: 12 }}>
                                 <Form.Item name={['personalHistory', 'quitDrinkingYears']} label="已戒酒年数">
                                     <Space.Compact>
                                       <InputNumber min={0} />
                                       <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0' }}>年</span>
                                     </Space.Compact>
                                 </Form.Item>
                             </Col>
                        )}
                    </>
                )}
            </Row>
          </div>

          <Form.Item name={['personalHistory', 'living_habits']} label="起居饮食">
              <Input placeholder="饮食习惯（如喜咸/甜/烫）、睡眠情况等" />
          </Form.Item>

          <Form.Item name={['personalHistory', 'substances']} label="其他嗜好">
              <Input placeholder="药物依赖、其他不良嗜好" />
          </Form.Item>
      </Card>
      
      <Card type="inner" title="3. 冶游史" size="small">
          <Form.Item name={['personalHistory', 'sexual_history']} label="冶游史">
              <TextArea placeholder="如有不洁性交史等，请记录" />
          </Form.Item>
      </Card>
    </div>
  );
};

export default PersonalHistorySection;
