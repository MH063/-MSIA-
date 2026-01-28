import React, { useEffect } from 'react';
import { Form, Input, Typography, Card, Row, Col, InputNumber, Select, DatePicker, Space } from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface MaritalHistorySectionProps {
  form: FormInstance;
}

const MaritalHistorySection: React.FC<MaritalHistorySectionProps> = ({ form }) => {
  const gender = Form.useWatch('gender', form);

  // 月经史相关字段监听
  const menarcheAge = Form.useWatch(['menstrualHistory', 'age'], form);
  const duration = Form.useWatch(['menstrualHistory', 'duration'], form);
  const cycle = Form.useWatch(['menstrualHistory', 'cycle'], form);
  const lmp = Form.useWatch(['menstrualHistory', 'lmp_date'], form); // 使用 DatePicker
  const menopauseAge = Form.useWatch(['menstrualHistory', 'menopause_age'], form);

  // 生育史相关字段监听
  const term = Form.useWatch(['fertilityHistory', 'term'], form);
  const preterm = Form.useWatch(['fertilityHistory', 'preterm'], form);
  const abortion = Form.useWatch(['fertilityHistory', 'abortion'], form);
  const living = Form.useWatch(['fertilityHistory', 'living'], form);

  /**
   * 自动生成月经史公式字符串并写入嵌套字段
   * 避免将根键 'menstrualHistory' 设置为字符串与其嵌套对象发生冲突，
   * 仅写入 ['menstrualHistory','formula_preview'] 与 ['menstrualHistory','text']
   */
  useEffect(() => {
    if (gender !== '女') return;
    
    let formula = '';
    // 格式: 初潮年龄 经期/周期 LMP
    if (menarcheAge) {
        formula += `${menarcheAge}`;
        if (duration && cycle) {
            formula += `(${duration}/${cycle})`;
        }
        if (lmp) {
            const lmpStr = dayjs(lmp).format('YYYY-MM-DD');
            formula += ` ${lmpStr}`;
        }
        if (menopauseAge) {
            formula += `，${menopauseAge}岁绝经`;
        }
    }
    
    if (formula) {
        form.setFieldValue(['menstrualHistory', 'formula_preview'], formula);
        form.setFieldValue(['menstrualHistory', 'text'], formula);
    }
  }, [gender, menarcheAge, duration, cycle, lmp, menopauseAge, form]);

  /**
   * 自动生成生育史公式字符串 (足-早-流-存)
   * 写入 ['fertilityHistory','summary'] 与 ['fertilityHistory','summary_preview']
   */
  useEffect(() => {
     if (gender !== '女') return;

     // 简单的 G_P_ 计算 (G = term + preterm + abortion, P = term + preterm)
     // 这里我们使用经典的 4位数表示法：足月-早产-流产-存活
     if (term !== undefined || preterm !== undefined || abortion !== undefined || living !== undefined) {
         const t = term || 0;
         const p = preterm || 0;
         const a = abortion || 0;
         const l = living || 0;
         const summary = `${t}-${p}-${a}-${l}`;
         
         // 假设后端该字段为字符串类型
         form.setFieldValue(['fertilityHistory', 'summary'], summary);
         form.setFieldValue(['fertilityHistory', 'summary_preview'], summary);
     }
  }, [gender, term, preterm, abortion, living, form]);

  useEffect(() => {
    if (gender !== '女') {
      // 如果切换为男性，清空女性特有字段
      // 注意：这里可能不需要清空，以免用户误操作导致数据丢失，
      // 但为了 UI 清洁，可以在提交时处理。
      // form.setFieldsValue({ ... });
    }
  }, [gender, form]);

  const childrenLabel = gender === '男' ? '育儿情况' : '子女情况';

  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>婚育史 (Marital & Childbearing History)</Title>
      
      {/* 隐藏字段：仅存储生成的文本，避免根键冲突 */}
      <Form.Item name={['menstrualHistory', 'text']} hidden><Input /></Form.Item>

      <Card type="inner" title="1. 婚姻史" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
            <Col span={8}>
                <Form.Item name={['maritalHistory', 'status']} label="婚姻状况">
                    <Select placeholder="选择">
                        <Option value="未婚">未婚</Option>
                        <Option value="已婚">已婚</Option>
                        <Option value="离异">离异</Option>
                        <Option value="丧偶">丧偶</Option>
                    </Select>
                </Form.Item>
            </Col>
            <Col span={8}>
                <Form.Item name={['maritalHistory', 'marriage_age']} label="结婚年龄">
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber style={{ width: '100%' }} min={0} max={120} />
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>岁</span>
                    </Space.Compact>
                </Form.Item>
            </Col>
            <Col span={8}>
                 <Form.Item name={['maritalHistory', 'spouse_health']} label="配偶健康">
                    <Input placeholder="健康/体健/患病..." />
                </Form.Item>
            </Col>
        </Row>
        <Form.Item name={['maritalHistory', 'children']} label={childrenLabel}>
            <Input placeholder="例如：1子1女，体健" />
        </Form.Item>
        <Form.Item name={['maritalHistory', 'other']} label="婚育说明">
            <Input.TextArea rows={2} placeholder="如：丁克/未育/计划生育说明等" />
        </Form.Item>
      </Card>

      {gender === '女' && (
      <Card type="inner" title="2. 月经史 (女性)" size="small" style={{ marginBottom: 24, borderColor: '#ffadd2' }}>
          <Row gutter={24}>
              <Col span={6}>
                  <Form.Item name={['menstrualHistory', 'age']} label="初潮年龄">
                      <Space.Compact style={{ width: '100%' }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={100} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>岁</span>
                      </Space.Compact>
                  </Form.Item>
              </Col>
              <Col span={6}>
                  <Form.Item name={['menstrualHistory', 'duration']} label="经期">
                      <Space.Compact style={{ width: '100%' }}>
                        <InputNumber style={{ width: '100%' }} min={1} max={30} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>天</span>
                      </Space.Compact>
                  </Form.Item>
              </Col>
              <Col span={6}>
                  <Form.Item name={['menstrualHistory', 'cycle']} label="周期">
                      <Space.Compact style={{ width: '100%' }}>
                        <InputNumber style={{ width: '100%' }} min={10} max={100} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>天</span>
                      </Space.Compact>
                  </Form.Item>
              </Col>
              <Col span={6}>
                  <Form.Item name={['menstrualHistory', 'lmp_date']} label="末次月经(LMP)">
                      <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
                  </Form.Item>
              </Col>
          </Row>
          <Row gutter={24}>
               <Col span={8}>
                   <Form.Item name={['menstrualHistory', 'flow']} label="经量">
                        <Select>
                            <Option value="中等">中等</Option>
                            <Option value="多">多</Option>
                            <Option value="少">少</Option>
                        </Select>
                   </Form.Item>
               </Col>
               <Col span={8}>
                   <Form.Item name={['menstrualHistory', 'pain']} label="痛经">
                        <Select>
                            <Option value="无">无</Option>
                            <Option value="轻度">轻度</Option>
                            <Option value="严重">严重</Option>
                        </Select>
                   </Form.Item>
               </Col>
               <Col span={8}>
                  <Form.Item name={['menstrualHistory', 'menopause_age']} label="绝经年龄">
                      <Space.Compact style={{ width: '100%' }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="如适用" />
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>岁</span>
                      </Space.Compact>
                  </Form.Item>
               </Col>
          </Row>
          <div style={{ marginTop: 8, padding: '8px', background: '#fff0f6', borderRadius: 4 }}>
              <Text type="secondary">月经公式预览：</Text> 
              <Text strong style={{ color: '#eb2f96' }}>{form.getFieldValue(['menstrualHistory', 'formula_preview']) || form.getFieldValue(['menstrualHistory', 'text']) || '待生成...'}</Text>
          </div>
      </Card>
      )}
      
      {gender === '女' && (
      <Card type="inner" title="3. 生育史 (女性)" size="small" style={{ borderColor: '#ffadd2' }}>
          <Row gutter={24} align="middle">
              <Col span={5}>
                  <Form.Item name={['fertilityHistory', 'term']} label="足月产" initialValue={0}>
                      <InputNumber min={0} />
                  </Form.Item>
              </Col>
              <Col span={1} style={{ textAlign: 'center', lineHeight: '32px' }}>-</Col>
              <Col span={5}>
                  <Form.Item name={['fertilityHistory', 'preterm']} label="早产" initialValue={0}>
                      <InputNumber min={0} />
                  </Form.Item>
              </Col>
              <Col span={1} style={{ textAlign: 'center', lineHeight: '32px' }}>-</Col>
              <Col span={5}>
                  <Form.Item name={['fertilityHistory', 'abortion']} label="流产" initialValue={0}>
                      <InputNumber min={0} />
                  </Form.Item>
              </Col>
              <Col span={1} style={{ textAlign: 'center', lineHeight: '32px' }}>-</Col>
              <Col span={5}>
                  <Form.Item name={['fertilityHistory', 'living']} label="存活" initialValue={0}>
                      <InputNumber min={0} />
                  </Form.Item>
              </Col>
          </Row>
          <div style={{ marginBottom: 16, padding: '8px', background: '#fff0f6', borderRadius: 4 }}>
              <Text type="secondary">生育公式预览 (足-早-流-存)：</Text> 
              <Text strong style={{ color: '#eb2f96' }}>{form.getFieldValue(['fertilityHistory', 'summary_preview']) || form.getFieldValue(['fertilityHistory', 'summary']) || '0-0-0-0'}</Text>
          </div>
          
           <Form.Item name={['fertilityHistory', 'details']} label="详细记录">
              <Input.TextArea placeholder="如有特殊生育经历请记录，如剖宫产、难产等" rows={2} />
          </Form.Item>
      </Card>
      )}
    </div>
  );
};

export default MaritalHistorySection;
