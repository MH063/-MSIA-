import React, { useEffect } from 'react';
import { Form, Input, Typography, Card, Row, Col, InputNumber, Select, Space } from 'antd';
import type { FormInstance } from 'antd';

const { Title } = Typography;
const { Option } = Select;

interface MaritalHistorySectionProps {
  form: FormInstance;
}

const MaritalHistorySection: React.FC<MaritalHistorySectionProps> = ({ form }) => {
  const gender = Form.useWatch('gender', form);

  useEffect(() => {
    if (gender !== '女') {
      form.setFieldsValue({
        menstrualHistory: undefined,
        fertilityHistory: undefined,
      });
    }
  }, [gender, form]);

  const childrenLabel = gender === '男' ? '育儿情况' : '子女情况';

  return (
    <div>
      <Title level={5}>婚育史 (Marital & Childbearing History)</Title>
      
      <Card type="inner" title="1. 婚姻史" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
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
                        <span style={{ padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, lineHeight: '32px', background: '#fafafa' }}>岁</span>
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
      <Card type="inner" title="2. 月经史 (女性)" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
              <Col span={6}>
                  <Form.Item name={['menstrualHistory', 'age']} label="初潮年龄">
                      <Space.Compact style={{ width: '100%' }}>
                          <InputNumber style={{ width: '100%' }} min={0} max={100} />
                          <span style={{ padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, lineHeight: '32px', background: '#fafafa' }}>岁</span>
                      </Space.Compact>
                  </Form.Item>
              </Col>
              <Col span={6}>
                  <Form.Item name={['menstrualHistory', 'duration']} label="经期">
                      <Space.Compact style={{ width: '100%' }}>
                          <InputNumber style={{ width: '100%' }} min={1} max={30} />
                          <span style={{ padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, lineHeight: '32px', background: '#fafafa' }}>天</span>
                      </Space.Compact>
                  </Form.Item>
              </Col>
              <Col span={6}>
                  <Form.Item name={['menstrualHistory', 'cycle']} label="周期">
                      <Space.Compact style={{ width: '100%' }}>
                          <InputNumber style={{ width: '100%' }} min={10} max={100} />
                          <span style={{ padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, lineHeight: '32px', background: '#fafafa' }}>天</span>
                      </Space.Compact>
                  </Form.Item>
              </Col>
          </Row>
          <Row gutter={16}>
               <Col span={12}>
                  <Form.Item name={['menstrualHistory', 'lmp']} label="末次月经 (LMP)">
                      <Input placeholder="日期或时间" />
                  </Form.Item>
               </Col>
               <Col span={12}>
                  <Form.Item name={['menstrualHistory', 'menopause_age']} label="绝经年龄 (如适用)">
                      <Space.Compact style={{ width: '100%' }}>
                          <InputNumber style={{ width: '100%' }} min={0} max={100} />
                          <span style={{ padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 6, lineHeight: '32px', background: '#fafafa' }}>岁</span>
                      </Space.Compact>
                  </Form.Item>
               </Col>
          </Row>
          <Row gutter={16}>
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
          </Row>
      </Card>
      )}
      
      {gender === '女' && (
      <Card type="inner" title="3. 生育史 (女性)" size="small">
          <Form.Item name={['fertilityHistory', 'summary']} label="生育概况">
              <Input placeholder="格式：足月产-早产-流产-存活 (例如 1-0-0-1)" />
          </Form.Item>
           <Form.Item name={['fertilityHistory', 'details']} label="详细记录">
              <Input.TextArea placeholder="如有特殊生育经历请记录" rows={2} />
          </Form.Item>
      </Card>
      )}
    </div>
  );
};

export default MaritalHistorySection;
