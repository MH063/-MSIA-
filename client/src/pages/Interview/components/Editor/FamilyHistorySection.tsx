import React from 'react';
import { Form, Input, Checkbox, Typography, Card, Row, Col } from 'antd';

const { Title } = Typography;
const { TextArea } = Input;

const geneticDiseases = [
  '高血压', '糖尿病', '冠心病', '脑卒中', 
  '结核', '肝炎', '恶性肿瘤', '癫痫', 
  '精神病', '哮喘', '痛风', '血友病'
];

const FamilyHistorySection: React.FC = () => {
  return (
    <div>
      <Title level={5}>家族史 (Family History)</Title>
      
      <Card type="inner" title="1. 家族成员健康状况" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
            <Col span={12}>
                <Form.Item name={['familyHistory', 'father']} label="父亲">
                    <Input placeholder="健康状况 / 患病情况 / 已故(死因)" />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name={['familyHistory', 'mother']} label="母亲">
                    <Input placeholder="健康状况 / 患病情况 / 已故(死因)" />
                </Form.Item>
            </Col>
        </Row>
        <Form.Item name={['familyHistory', 'siblings']} label="兄弟姐妹">
            <Input placeholder="健康状况" />
        </Form.Item>
        <Form.Item name={['familyHistory', 'children']} label="子女">
            <Input placeholder="健康状况" />
        </Form.Item>
      </Card>

      <Card type="inner" title="2. 家族遗传病史" size="small" style={{ marginBottom: 16 }}>
        <Form.Item name={['familyHistory', 'genetic_diseases']} label="家族中是否有以下疾病">
           <Checkbox.Group>
               <Row>
                   {geneticDiseases.map(d => (
                       <Col span={6} key={d} style={{ marginBottom: 8 }}>
                           <Checkbox value={d}>{d}</Checkbox>
                       </Col>
                   ))}
               </Row>
           </Checkbox.Group>
        </Form.Item>
      </Card>

      <Card type="inner" title="3. 其他" size="small">
          <Form.Item name={['familyHistory', 'deceased']} label="已故亲属及死因">
              <TextArea placeholder="如有，请记录" rows={2} />
          </Form.Item>
          <Form.Item name={['familyHistory', 'other']} label="其他说明">
              <TextArea placeholder="其他家族性/遗传性疾病" rows={2} />
          </Form.Item>
      </Card>
    </div>
  );
};

export default FamilyHistorySection;
