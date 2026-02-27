import React, { useEffect } from 'react';
import { Form, Input, InputNumber, Card, Row, Col, Select, Typography } from 'antd';
import MenstrualHistorySection from './MenstrualHistorySection';
import { logger } from '../../../../utils/logger';

const { Option } = Select;
const { Title } = Typography;

const MaritalHistorySection: React.FC = () => {
  const form = Form.useFormInstance();
  const gender = Form.useWatch('gender', form);
  const isFemale = gender === '女';

  // 监听婚姻状况字段，用于双向同步
  const maritalStatus = Form.useWatch(['maritalHistory', 'status'], form);

  /**
   * 双向同步：婚姻状况
   * 婚育史 -> 一般项目
   * 由于两个模块使用相同的字段路径 ['maritalHistory', 'status']
   * Form 会自动处理同步，这里添加日志记录
   */
  useEffect(() => {
    if (maritalStatus) { logger.info('[MaritalHistory] 婚姻状况变更', { status: maritalStatus }); }
  }, [maritalStatus]);

  return (
    <div className="section-container">
      <Title level={4} style={{ 
        marginBottom: 24, 
        fontWeight: 600,
        color: 'var(--msia-text-primary)',
        letterSpacing: 0.5,
        paddingBottom: 12,
        borderBottom: '2px solid var(--msia-primary)',
        display: 'inline-block',
      }}>婚姻状况 <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--msia-text-tertiary)', marginLeft: 8 }}>Marital Status</span></Title>
      
      <Card type="inner" title={<span style={{ fontWeight: 600, color: 'var(--msia-text-secondary)' }}>【婚姻状况】</span>} size="small" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name={['maritalHistory', 'status']}
              label="婚姻状况"
              rules={[{ required: true, message: '请选择婚姻状况' }]}
            >
              <Select placeholder="请选择">
                <Option value="未婚">未婚</Option>
                <Option value="已婚">已婚</Option>
                <Option value="离异">离异</Option>
                <Option value="丧偶">丧偶</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.maritalHistory?.status !== curr.maritalHistory?.status}
            >
              {({ getFieldValue }) => {
                const status = getFieldValue(['maritalHistory', 'status']);
                return status !== '未婚' ? (
                  <Form.Item name={['maritalHistory', 'marriage_age']} label="结婚年龄(岁)">
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                ) : null;
              }}
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) => prev.maritalHistory?.status !== curr.maritalHistory?.status}
        >
          {({ getFieldValue }) => {
            const status = getFieldValue(['maritalHistory', 'status']);
            return status !== '未婚' ? (
              <Form.Item name={['maritalHistory', 'spouse_health']} label="配偶健康状况">
                <Input placeholder="例如: 体健，或有高血压病史" />
              </Form.Item>
            ) : null;
          }}
        </Form.Item>
      </Card>

      {isFemale && (
        <>
          <MenstrualHistorySection />

          <Card type="inner" title={<span style={{ fontWeight: 600, color: 'var(--msia-text-secondary)' }}>【生育史】</span>} size="small" style={{ marginTop: 24 }}>
            <Row gutter={24}>
              <Col span={6}>
                <Form.Item name={['fertilityHistory', 'term']} label="足月产(次)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name={['fertilityHistory', 'preterm']} label="早产(次)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name={['fertilityHistory', 'abortion']} label="流产(次)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name={['fertilityHistory', 'living']} label="现存子女(人)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </>
      )}
    </div>
  );
};

export default MaritalHistorySection;
