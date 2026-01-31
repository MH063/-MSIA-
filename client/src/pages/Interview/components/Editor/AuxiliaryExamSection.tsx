import React from 'react';
import { Form, Input, Row, Col, Typography, Card, Button, DatePicker } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { TextArea } = Input;

const AuxiliaryExamSection: React.FC = () => {
  // 使用 Form.List 管理辅助检查数组
  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>辅助检查 (Auxiliary Examination)</Title>
      
      <Form.Item name={['auxiliaryExams', 'summary']} label="辅助检查综述" help="可在此处粘贴完整的检查报告摘要">
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
                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item
                      {...restField}
                      name={[name, 'date']}
                      label="检查日期"
                      rules={[{ required: true, message: '请选择日期' }]}
                    >
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      {...restField}
                      name={[name, 'institution']}
                      label="检查机构"
                    >
                      <Input placeholder="院内/院外" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
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
