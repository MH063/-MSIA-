import React, { useEffect } from 'react';
import { Form, Input, Row, Col, Typography, Card, Button, DatePicker, Checkbox, Grid } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

const AuxiliaryExamSection: React.FC = () => {
  const form = Form.useFormInstance();
  const none = Form.useWatch(['auxiliaryExams', 'none'], form);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  useEffect(() => {
    if (!none) return;
    const curr = form.getFieldValue('auxiliaryExams') as Record<string, unknown> | undefined;
    if (!curr || typeof curr !== 'object') {
      form.setFieldValue('auxiliaryExams', { none: true });
      return;
    }
    const next: Record<string, unknown> = { ...curr, none: true, summary: undefined, exams: [] };
    form.setFieldValue('auxiliaryExams', next);
  }, [form, none]);

  // 使用 Form.List 管理辅助检查数组
  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>辅助检查 (Auxiliary Examination)</Title>
      
      <Form.Item name={['auxiliaryExams', 'none']} valuePropName="checked">
        <Checkbox>无辅助检查</Checkbox>
      </Form.Item>

      <Form.Item
        name={['auxiliaryExams', 'summary']}
        label="辅助检查综述"
        help="可在此处粘贴完整的检查报告摘要"
        rules={[
          {
            validator: async (_rule, value) => {
              const isNone = Boolean(form.getFieldValue(['auxiliaryExams', 'none']));
              const exams = form.getFieldValue(['auxiliaryExams', 'exams']) as unknown;
              const hasExam = Array.isArray(exams) && exams.length > 0;
              const hasSummary = typeof value === 'string' && value.trim().length > 0;
              if (isNone || hasExam || hasSummary) return;
              throw new Error('请填写辅助检查综述、添加记录或勾选“无辅助检查”');
            }
          }
        ]}
      >
        <TextArea rows={3} placeholder="如：血常规正常，胸部CT示双肺纹理增多..." />
      </Form.Item>
      
      <Form.List name={['auxiliaryExams', 'exams']}>
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }, index) => (
              <Card 
                key={key} 
                type="inner" 
                size="small" 
                style={{ marginBottom: 16 }}
                title={`检查记录 ${index + 1}`}
                extra={
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={() => remove(name)}
                  >
                    删除
                  </Button>
                }
              >
                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item
                      {...restField}
                      name={[name, 'date']}
                      label="检查日期"
                      rules={[{ required: true, message: '请选择日期' }]}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        placement="bottomLeft"
                        classNames={{ popup: { root: isMobile ? 'msia-mobile-picker' : undefined } }}
                        getPopupContainer={(trigger) => (isMobile ? document.body : trigger.parentElement ?? document.body)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item
                      {...restField}
                      name={[name, 'institution']}
                      label="检查机构"
                    >
                      <Input placeholder="院内/院外" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item
                      {...restField}
                      name={[name, 'name']}
                      label="检查项目"
                      rules={[{ required: true, message: '请输入项目名称' }]}
                    >
                      <Input placeholder="如：血常规、胸部CT" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item
                      {...restField}
                      name={[name, 'result']}
                      label="检查结果/报告"
                    >
                      <TextArea rows={3} placeholder="输入检查结果或粘贴报告内容" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            ))}
            
            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
              添加辅助检查记录
            </Button>
          </>
        )}
      </Form.List>
    </div>
  );
};

export default AuxiliaryExamSection;
