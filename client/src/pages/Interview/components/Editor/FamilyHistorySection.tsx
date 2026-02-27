import React from 'react';
import { Form, Input, Card, Row, Col, theme, Select, Typography } from 'antd';

const { TextArea } = Input;
const { Title } = Typography;

// 健康状况选项
const healthStatusOptions = [
  { value: '体健', label: '体健' },
  { value: '已故', label: '已故' },
  { value: '患有高血压', label: '患有高血压' },
  { value: '患有糖尿病', label: '患有糖尿病' },
  { value: '患有心脏病', label: '患有心脏病' },
  { value: '患有脑血管病', label: '患有脑血管病' },
  { value: '患有肿瘤', label: '患有肿瘤' },
  { value: '患有慢性肾病', label: '患有慢性肾病' },
  { value: '患有肝病', label: '患有肝病' },
  { value: '患有精神疾病', label: '患有精神疾病' },
  { value: '其他', label: '其他（请补充说明）' }
];

// 家族遗传病史选项
const geneticOptions = [
  { value: '否认家族性遗传病史', label: '否认家族性遗传病史' },
  { value: '高血压', label: '高血压' },
  { value: '糖尿病', label: '糖尿病' },
  { value: '冠心病', label: '冠心病' },
  { value: '脑血管病', label: '脑血管病' },
  { value: '恶性肿瘤', label: '恶性肿瘤' },
  { value: '血友病', label: '血友病' },
  { value: '地中海贫血', label: '地中海贫血' },
  { value: '遗传性耳聋', label: '遗传性耳聋' },
  { value: '色盲/色弱', label: '色盲/色弱' },
  { value: '哮喘', label: '哮喘' },
  { value: '其他', label: '其他（请补充说明）' }
];

// 类似疾病史选项
const similarOptions = [
  { value: '否认家族中有类似疾病患者', label: '否认家族中有类似疾病患者' },
  { value: '父亲患有', label: '父亲患有' },
  { value: '母亲患有', label: '母亲患有' },
  { value: '父母均患有', label: '父母均患有' },
  { value: '兄弟姐妹患有', label: '兄弟姐妹患有' },
  { value: '子女患有', label: '子女患有' },
  { value: '多位亲属患有', label: '多位亲属患有' },
  { value: '其他', label: '其他（请补充说明）' }
];

type FamilyHistoryValues = {
  father?: string;
  mother?: string;
  siblings?: string;
  children?: string;
  genetic?: string;
  similar?: string;
  fatherDetail?: string;
  motherDetail?: string;
  siblingsDetail?: string;
  childrenDetail?: string;
  geneticDetail?: string;
  similarDetail?: string;
};

const FamilyHistorySection: React.FC = () => {
  const form = Form.useFormInstance();
  const { token } = theme.useToken();
  
  // 监听各个字段以实时生成总结
  const father = Form.useWatch(['familyHistory', 'father'], form);
  const mother = Form.useWatch(['familyHistory', 'mother'], form);
  const siblings = Form.useWatch(['familyHistory', 'siblings'], form);
  const children = Form.useWatch(['familyHistory', 'children'], form);
  const genetic = Form.useWatch(['familyHistory', 'genetic'], form);
  const similar = Form.useWatch(['familyHistory', 'similar'], form);
  const fatherDetail = Form.useWatch(['familyHistory', 'fatherDetail'], form);
  const motherDetail = Form.useWatch(['familyHistory', 'motherDetail'], form);
  const siblingsDetail = Form.useWatch(['familyHistory', 'siblingsDetail'], form);
  const childrenDetail = Form.useWatch(['familyHistory', 'childrenDetail'], form);
  const geneticDetail = Form.useWatch(['familyHistory', 'geneticDetail'], form);
  const similarDetail = Form.useWatch(['familyHistory', 'similarDetail'], form);
  
  const userModifiedRef = React.useRef(false);
  const lastValuesRef = React.useRef<FamilyHistoryValues>({});

  // 自动生成家族史总结
  React.useEffect(() => {
    const currentValues = { father, mother, siblings, children, genetic, similar, fatherDetail, motherDetail, siblingsDetail, childrenDetail, geneticDetail, similarDetail };
    const hasChanged = JSON.stringify(currentValues) !== JSON.stringify(lastValuesRef.current);
    lastValuesRef.current = currentValues;

    if (!hasChanged) return;

    const parts: string[] = [];
    if (father) {
      const detail = father === '其他' && fatherDetail ? `(${fatherDetail})` : '';
      parts.push(`父亲${father}${detail}`);
    }
    if (mother) {
      const detail = mother === '其他' && motherDetail ? `(${motherDetail})` : '';
      parts.push(`母亲${mother}${detail}`);
    }
    if (siblings) {
      const detail = siblings === '其他' && siblingsDetail ? `(${siblingsDetail})` : '';
      parts.push(`兄弟姐妹${siblings}${detail}`);
    }
    if (children) {
      const detail = children === '其他' && childrenDetail ? `(${childrenDetail})` : '';
      parts.push(`子女${children}${detail}`);
    }
    if (genetic) {
      const detail = genetic === '其他' && geneticDetail ? `(${geneticDetail})` : '';
      parts.push(`家族遗传病史：${genetic}${detail}`);
    }
    if (similar) {
      const detail = similar === '其他' && similarDetail ? `(${similarDetail})` : '';
      parts.push(`类似疾病史：${similar}${detail}`);
    }

    const autoText = parts.length > 0 ? parts.join('；') + '。' : '';
    
    // 仅当非用户手动修改时更新
    if (!userModifiedRef.current) {
        form.setFieldValue(['familyHistory', 'summary'], autoText);
    }
  }, [father, mother, siblings, children, genetic, similar, fatherDetail, motherDetail, siblingsDetail, childrenDetail, geneticDetail, similarDetail, form]);

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
      }}>家族史 <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--msia-text-tertiary)', marginLeft: 8 }}>Family History</span></Title>
      
      <Card type="inner" title={<span style={{ fontWeight: 600, color: 'var(--msia-text-secondary)' }}>【家族史】</span>} size="small">
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name={['familyHistory', 'father']} label="父亲健康状况">
              <Select
                placeholder="请选择父亲健康状况"
                options={healthStatusOptions}
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            {father === '其他' && (
              <Form.Item name={['familyHistory', 'fatherDetail']} noStyle>
                <Input placeholder="请补充说明父亲健康状况" style={{ marginTop: 8 }} />
              </Form.Item>
            )}
            {father === '已故' && (
              <Form.Item name={['familyHistory', 'fatherDetail']} noStyle>
                <Input placeholder="请填写死因" style={{ marginTop: 8 }} />
              </Form.Item>
            )}
          </Col>
          <Col span={12}>
            <Form.Item name={['familyHistory', 'mother']} label="母亲健康状况">
              <Select
                placeholder="请选择母亲健康状况"
                options={healthStatusOptions}
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            {mother === '其他' && (
              <Form.Item name={['familyHistory', 'motherDetail']} noStyle>
                <Input placeholder="请补充说明母亲健康状况" style={{ marginTop: 8 }} />
              </Form.Item>
            )}
            {mother === '已故' && (
              <Form.Item name={['familyHistory', 'motherDetail']} noStyle>
                <Input placeholder="请填写死因" style={{ marginTop: 8 }} />
              </Form.Item>
            )}
          </Col>
        </Row>

        <Form.Item name={['familyHistory', 'siblings']} label="兄弟姐妹健康状况">
          <Select
            placeholder="请选择兄弟姐妹健康状况"
            options={healthStatusOptions}
            allowClear
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        {siblings === '其他' && (
          <Form.Item name={['familyHistory', 'siblingsDetail']} noStyle>
            <Input placeholder="请补充说明兄弟姐妹健康状况" style={{ marginBottom: 24 }} />
          </Form.Item>
        )}

        <Form.Item name={['familyHistory', 'children']} label="子女健康状况">
          <Select
            placeholder="请选择子女健康状况"
            options={healthStatusOptions}
            allowClear
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        {children === '其他' && (
          <Form.Item name={['familyHistory', 'childrenDetail']} noStyle>
            <Input placeholder="请补充说明子女健康状况" style={{ marginBottom: 24 }} />
          </Form.Item>
        )}

        <Form.Item name={['familyHistory', 'genetic']} label="家族遗传病史">
          <Select
            placeholder="请选择家族遗传病史"
            options={geneticOptions}
            allowClear
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        {genetic === '其他' && (
          <Form.Item name={['familyHistory', 'geneticDetail']} noStyle>
            <Input placeholder="请补充说明家族遗传病史" style={{ marginBottom: 24 }} />
          </Form.Item>
        )}

        <Form.Item name={['familyHistory', 'similar']} label="类似疾病史">
          <Select
            placeholder="请选择类似疾病史"
            options={similarOptions}
            allowClear
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        {similar === '其他' && (
          <Form.Item name={['familyHistory', 'similarDetail']} noStyle>
            <Input placeholder="请补充说明类似疾病史" style={{ marginBottom: 24 }} />
          </Form.Item>
        )}

        <div style={{
          background: token.colorFillAlter,
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
          border: `1px solid ${token.colorBorderSecondary}`
        }}>
          <Form.Item name={['familyHistory', 'summary']} label="家族史综述" style={{ marginBottom: 0 }}>
              <TextArea rows={3} placeholder="自动生成的综述..." onChange={() => userModifiedRef.current = true} />
          </Form.Item>
        </div>
      </Card>
    </div>
  );
};

export default FamilyHistorySection;
