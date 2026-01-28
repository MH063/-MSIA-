import React from 'react';
import { Form, Input, InputNumber, Typography, Card, Row, Col, Tag, Space, Divider, Button } from 'antd';
import { UserOutlined, TeamOutlined, SyncOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { CheckableTag } = Tag;

const GENETIC_DISEASES = [
  '高血压', '糖尿病', '冠心病', '脑卒中', 
  '结核', '肝炎', '恶性肿瘤', '癫痫', 
  '精神病', '哮喘', '痛风', '血友病'
];

const RELATIVES = ['父亲', '母亲', '兄弟姐妹', '子女', '祖父母/外祖父母'];

const FamilyHistorySection: React.FC = () => {
  const form = Form.useFormInstance();
  
  // 监听字段
  const fatherHealth = Form.useWatch(['familyHistory', 'father'], form);
  const motherHealth = Form.useWatch(['familyHistory', 'mother'], form);
  const siblingsHealth = Form.useWatch(['familyHistory', 'siblings'], form);
  const childrenHealth = Form.useWatch(['familyHistory', 'children'], form);
  const selectedDiseases = Form.useWatch(['familyHistory', 'genetic_diseases'], form) || [];
  const diseaseMap = Form.useWatch(['familyHistory', 'diseaseMap'], form) || {};

  // 处理疾病标签点击
  const handleDiseaseChange = (disease: string, checked: boolean) => {
      const nextSelected = checked 
          ? [...selectedDiseases, disease]
          : selectedDiseases.filter((t: string) => t !== disease);
      form.setFieldValue(['familyHistory', 'genetic_diseases'], nextSelected);
      
      if (!checked) {
          // 如果取消选中，也清除关联关系
          const newMap = { ...diseaseMap };
          delete newMap[disease];
          form.setFieldValue(['familyHistory', 'diseaseMap'], newMap);
      }
  };

  // 处理亲属关联
  const toggleRelative = (disease: string, relative: string) => {
      const currentRelatives = diseaseMap[disease] || [];
      const newRelatives = currentRelatives.includes(relative)
          ? currentRelatives.filter((r: string) => r !== relative)
          : [...currentRelatives, relative];
      
      form.setFieldValue(['familyHistory', 'diseaseMap'], {
          ...diseaseMap,
          [disease]: newRelatives
      });
  };

  // 自动生成家族史总结
  const generateSummary = () => {
      const parts = [];
      if (fatherHealth) parts.push(`父亲：${fatherHealth}`);
      if (motherHealth) parts.push(`母亲：${motherHealth}`);
      if (siblingsHealth) parts.push(`兄弟姐妹：${siblingsHealth}`);
      if (childrenHealth) parts.push(`子女：${childrenHealth}`);
      
      // 处理遗传病详情
      const diseaseDetails = Object.entries(diseaseMap)
          .map(([disease, relatives]) => {
              const rels = relatives as string[];
              if (rels.length > 0) return `${disease}(${rels.join('、')})`;
              return disease; // 如果没选亲属，只列出病名
          });
      
      if (diseaseDetails.length > 0) {
          parts.push(`家族遗传病史：${diseaseDetails.join('；')}`);
      } else if (selectedDiseases.length > 0) {
          // 兼容只选了 checkbox 但没关联亲属的情况
          const unmapped = selectedDiseases.filter((d: string) => !diseaseMap[d]);
          if (unmapped.length > 0) parts.push(`家族遗传病史：${unmapped.join('、')}`);
      }

      if (parts.length > 0) {
          form.setFieldValue(['familyHistory', 'other'], parts.join('；\n') + '。');
      }
  };

  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>家族史 (Family History)</Title>
      
      <Row gutter={24}>
          <Col span={12}>
              <Card type="inner" title="1. 直系亲属健康状况" size="small" style={{ marginBottom: 24, height: '100%' }}>
                <Form.Item name={['familyHistory', 'father']} label={<span><UserOutlined /> 父亲</span>}>
                    <Input placeholder="健康 / 患病 / 已故(死因)" allowClear />
                </Form.Item>
                <Form.Item name={['familyHistory', 'mother']} label={<span><UserOutlined /> 母亲</span>}>
                    <Input placeholder="健康 / 患病 / 已故(死因)" allowClear />
                </Form.Item>
                <Divider style={{ margin: '12px 0' }} />
                <Form.Item name={['familyHistory', 'siblings']} label={<span><TeamOutlined /> 兄弟姐妹</span>}>
                    <Input placeholder="健康状况" allowClear />
                </Form.Item>
                <Form.Item name={['familyHistory', 'children']} label={<span><TeamOutlined /> 子女</span>}>
                    <Input placeholder="健康状况" allowClear />
                </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name={['familyHistory', 'childrenAliveCount']} label="子女存活数">
                      <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name={['familyHistory', 'childrenDeceasedCount']} label="子女已故数">
                      <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
                
                {/* 隐藏字段存储结构化数据，确保 Tab 切换或页面刷新（如果支持）不丢失 */}
                <Form.Item name={['familyHistory', 'diseaseMap']} hidden><Input /></Form.Item>
              </Card>
          </Col>
          
          <Col span={12}>
              <Card type="inner" title="2. 遗传病史图谱化录入" size="small" style={{ marginBottom: 24, height: '100%' }}>
                <Form.Item name={['familyHistory', 'genetic_diseases']} noStyle>
                   <div style={{ marginBottom: 16 }}>
                       <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>点击选择疾病，再点击下方亲属进行关联：</Text>
                       <Space size={[0, 8]} wrap>
                           {GENETIC_DISEASES.map(tag => (
                               <CheckableTag
                                   key={tag}
                                   checked={selectedDiseases.includes(tag)}
                                   onChange={checked => handleDiseaseChange(tag, checked)}
                                   style={{ border: '1px solid #d9d9d9', padding: '2px 8px' }}
                               >
                                   {tag}
                               </CheckableTag>
                           ))}
                       </Space>
                   </div>
                </Form.Item>

                {selectedDiseases.length > 0 && (
                    <div style={{ background: '#f6ffed', padding: 12, borderRadius: 4, border: '1px solid #b7eb8f' }}>
                        {selectedDiseases.map((disease: string) => (
                            <div key={disease} style={{ marginBottom: 8 }}>
                                <Text strong style={{ marginRight: 8, color: '#389e0d' }}>{disease} :</Text>
                                <Space size={4} wrap>
                                    {RELATIVES.map(rel => (
                                        <Tag.CheckableTag
                                            key={rel}
                                            checked={(diseaseMap[disease] || []).includes(rel)}
                                            onChange={() => toggleRelative(disease, rel)}
                                            style={{ fontSize: 12 }}
                                        >
                                            {rel}
                                        </Tag.CheckableTag>
                                    ))}
                                </Space>
                            </div>
                        ))}
                    </div>
                )}
              </Card>
          </Col>
      </Row>

      <Card type="inner" title="3. 汇总与补充" size="small">
          <div style={{ marginBottom: 16 }}>
              <Button type="primary" ghost size="small" icon={<SyncOutlined />} onClick={generateSummary}>
                  自动生成家族史摘要
              </Button>
              <Text type="secondary" style={{ marginLeft: 8 }}>* 将基于上方信息生成到“其他说明”中</Text>
          </div>
          
          <Row gutter={24}>
              <Col span={12}>
                  <Form.Item name={['familyHistory', 'deceased']} label="已故亲属及死因">
                      <TextArea placeholder="如有，请记录" rows={3} />
                  </Form.Item>
              </Col>
              <Col span={12}>
                  <Form.Item name={['familyHistory', 'other']} label="其他说明 / 自动摘要">
                      <TextArea placeholder="其他家族性/遗传性疾病..." rows={3} />
                  </Form.Item>
              </Col>
          </Row>
      </Card>
    </div>
  );
};

export default FamilyHistorySection;
