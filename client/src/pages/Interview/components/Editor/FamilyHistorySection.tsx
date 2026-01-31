import React from 'react';
import { Form, Input, Card, Row, Col } from 'antd';

const { TextArea } = Input;

type FamilyHistoryValues = {
  father?: string;
  mother?: string;
  siblings?: string;
  children?: string;
  genetic?: string;
  similar?: string;
};

const FamilyHistorySection: React.FC = () => {
  const form = Form.useFormInstance();
  
  // 监听各个字段以实时生成总结
  const father = Form.useWatch(['familyHistory', 'father'], form);
  const mother = Form.useWatch(['familyHistory', 'mother'], form);
  const siblings = Form.useWatch(['familyHistory', 'siblings'], form);
  const children = Form.useWatch(['familyHistory', 'children'], form);
  const genetic = Form.useWatch(['familyHistory', 'genetic'], form);
  const similar = Form.useWatch(['familyHistory', 'similar'], form);
  
  const userModifiedRef = React.useRef(false);
  const lastValuesRef = React.useRef<FamilyHistoryValues>({});

  // 自动生成家族史总结
  React.useEffect(() => {
    const currentValues = { father, mother, siblings, children, genetic, similar };
    const hasChanged = JSON.stringify(currentValues) !== JSON.stringify(lastValuesRef.current);
    lastValuesRef.current = currentValues;

    if (!hasChanged) return;

    const parts: string[] = [];
    if (father) parts.push(`父亲${father}`);
    if (mother) parts.push(`母亲${mother}`);
    if (siblings) parts.push(`兄弟姐妹${siblings}`);
    if (children) parts.push(`子女${children}`);
    if (genetic) parts.push(`家族遗传病史：${genetic}`);
    if (similar) parts.push(`类似疾病史：${similar}`);

    const autoText = parts.length > 0 ? parts.join('；') + '。' : '';
    
    // 仅当非用户手动修改时更新
    if (!userModifiedRef.current) {
        form.setFieldValue(['familyHistory', 'summary'], autoText);
    }
  }, [father, mother, siblings, children, genetic, similar, form]);

  return (
    <div className="section-container">
      <Card type="inner" title="家族史 (Family History)" size="small">
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name={['familyHistory', 'father']} label="父亲健康状况">
              <Input placeholder="例如: 体健，或已故(死因...)" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name={['familyHistory', 'mother']} label="母亲健康状况">
              <Input placeholder="例如: 体健，或患有糖尿病" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name={['familyHistory', 'siblings']} label="兄弟姐妹健康状况">
          <Input placeholder="例如: 均体健，或一兄患有高血压" />
        </Form.Item>

        <Form.Item name={['familyHistory', 'children']} label="子女健康状况">
          <Input placeholder="例如: 均体健" />
        </Form.Item>

        <Form.Item name={['familyHistory', 'genetic']} label="家族遗传病史">
          <Input placeholder="例如: 否认家族性遗传病史，或祖父患有血友病" />
        </Form.Item>

        <Form.Item name={['familyHistory', 'similar']} label="类似疾病史">
          <Input placeholder="例如: 否认家族中有类似疾病患者" />
        </Form.Item>

        <Form.Item name={['familyHistory', 'summary']} label="家族史综述">
            <TextArea rows={3} placeholder="自动生成的综述..." onChange={() => userModifiedRef.current = true} />
        </Form.Item>
      </Card>
    </div>
  );
};

export default FamilyHistorySection;
