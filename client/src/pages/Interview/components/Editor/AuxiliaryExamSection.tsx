import React, { useEffect, useState } from 'react';
import { Form, Input, Row, Col, Typography, Card, Button, Checkbox, Grid, Upload, Modal, message } from 'antd';
import LazyDatePicker from '../../../../components/lazy/LazyDatePicker';
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;
 
const AuxiliaryExamSection: React.FC = () => {
  const form = Form.useFormInstance();
  const none = Form.useWatch(['auxiliaryExams', 'none'], form);
  const exams = Form.useWatch(['auxiliaryExams', 'exams'], form);
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // 判断是否存在检查记录
  const hasExams = Array.isArray(exams) && exams.length > 0;

  const uploadProps = {
    name: 'file',
    multiple: true,
    accept: 'image/*,.pdf',
    listType: 'picture-card' as const,
    beforeUpload: (file: File) => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      if (!isImage && !isPdf) {
        message.error('只能上传图片或PDF文件');
        return Upload.LIST_IGNORE;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过10MB');
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    onPreview: (file: { url?: string; preview?: string }) => {
      setPreviewImage(file.url || file.preview || '');
      setPreviewOpen(true);
    },
  };

  // 监听"无辅助检查"勾选状态变化
  useEffect(() => {
    if (!none) return;
    // 当勾选"无辅助检查"时，清空所有检查记录和综述
    const curr = form.getFieldValue('auxiliaryExams') as Record<string, unknown> | undefined;
    if (!curr || typeof curr !== 'object') {
      form.setFieldValue('auxiliaryExams', { none: true });
      return;
    }
    const next: Record<string, unknown> = { ...curr, none: true, summary: undefined, exams: [] };
    form.setFieldValue('auxiliaryExams', next);
  }, [form, none]);

  // 监听检查记录变化，当添加记录后自动取消"无辅助检查"勾选
  useEffect(() => {
    if (hasExams && none) {
      // 当存在检查记录且"无辅助检查"被勾选时，自动取消勾选
      const curr = form.getFieldValue('auxiliaryExams') as Record<string, unknown> | undefined;
      if (curr && typeof curr === 'object') {
        form.setFieldValue(['auxiliaryExams', 'none'], false);
      }
    }
  }, [form, hasExams, none, exams]);

  // 处理添加检查记录
  const handleAddExam = (add: () => void) => {
    // 如果"无辅助检查"被勾选，先取消勾选
    if (none) {
      form.setFieldValue(['auxiliaryExams', 'none'], false);
    }
    add();
  };

  // 使用 Form.List 管理辅助检查数组
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
      }}>辅助检查 <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--msia-text-tertiary)', marginLeft: 8 }}>Auxiliary Examination</span></Title>
      
      <Form.Item name={['auxiliaryExams', 'none']} valuePropName="checked">
        <Checkbox disabled={hasExams}>无辅助检查</Checkbox>
      </Form.Item>

      {!none && (
        <Form.Item
          name={['auxiliaryExams', 'summary']}
          label="辅助检查综述"
          help="可在此处粘贴完整的检查报告摘要"
          rules={[
            {
              validator: async (_rule, value) => {
                const isNone = Boolean(form.getFieldValue(['auxiliaryExams', 'none']));
                const examsList = form.getFieldValue(['auxiliaryExams', 'exams']) as unknown;
                const hasExamList = Array.isArray(examsList) && examsList.length > 0;
                const hasSummary = typeof value === 'string' && value.trim().length > 0;
                if (isNone || hasExamList || hasSummary) return;
                throw new Error('请填写辅助检查综述、添加记录或勾选"无辅助检查"');
              }
            }
          ]}
        >
          <TextArea rows={3} placeholder="如：血常规正常，胸部CT示双肺纹理增多..." />
        </Form.Item>
      )}
      
      {!none && (
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
                        <LazyDatePicker
                          style={{ width: '100%' }}
                          placement="bottomLeft"
                          classNames={{ popup: { root: isMobile ? 'msia-mobile-picker' : undefined } }}
                          getPopupContainer={(trigger: HTMLElement) => (isMobile ? document.body : trigger.parentElement ?? document.body)}
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
                    <Col span={24}>
                      <Form.Item
                        {...restField}
                        name={[name, 'attachments']}
                        label="检查报告图片/附件"
                        help="支持上传检查报告的图片或PDF文件（单张≤10MB）"
                        valuePropName="fileList"
                        getValueFromEvent={(e: unknown) => {
                          if (Array.isArray(e)) return e;
                          if (e && typeof e === 'object' && 'fileList' in e) {
                            const withFiles = e as { fileList?: unknown[] };
                            return withFiles.fileList || [];
                          }
                          return [];
                        }}
                      >
                        <Upload.Dragger {...uploadProps}>
                          <p className="ant-upload-drag-icon">
                            <UploadOutlined />
                          </p>
                          <p className="ant-upload-text">点击或拖拽上传检查报告</p>
                          <p className="ant-upload-hint">支持单张或批量上传图片或PDF文件</p>
                        </Upload.Dragger>
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ))}
              
              <Button type="dashed" onClick={() => handleAddExam(add)} block icon={<PlusOutlined />}>
                添加辅助检查记录
              </Button>
            </>
          )}
        </Form.List>
      )}

      <Modal
        open={previewOpen}
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        width={800}
        centered
      >
        <img alt="检查报告" style={{ width: '100%' }} src={previewImage} />
      </Modal>
    </div>
  );
};

export default AuxiliaryExamSection;
