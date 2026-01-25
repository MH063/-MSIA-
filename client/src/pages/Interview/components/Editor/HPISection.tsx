import React from 'react';
import { Form, Input, Radio, Checkbox, Row, Col, Typography, Card, Select } from 'antd';

const { Title } = Typography;
const { TextArea } = Input;

/**
 * HPISection
 * 现病史编辑分节：包含起病、症状特点、伴随症状、诊治经过与一般情况
 */
const HPISection: React.FC = () => {
  return (
    <div>
      <Title level={5}>现病史 (History of Present Illness)</Title>
      
      {/* 1. 起病情况 */}
      <Card type="inner" title="1. 起病情况与时间" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name={['presentIllness', 'onsetMode']} label="起病形式">
              <Radio.Group>
                <Radio value="sudden">突然</Radio>
                <Radio value="gradual">缓慢</Radio>
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={['presentIllness', 'onsetTime']} label="确切时间">
               <Input placeholder="如：3天前午饭后" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={['presentIllness', 'trigger']} label="诱因">
               <Input placeholder="如：受凉、饮食不洁" />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* 2. 主要症状特点 */}
      <Card type="inner" title="2. 主要症状特点" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
             <Form.Item name={['presentIllness', 'location']} label="部位">
                <Input placeholder="疼痛/不适具体部位" />
             </Form.Item>
          </Col>
          <Col span={12}>
             <Form.Item name={['presentIllness', 'quality']} label="性质">
                <Select mode="tags" placeholder="选择或输入">
                    <Select.Option value="绞痛">绞痛</Select.Option>
                    <Select.Option value="钝痛">钝痛</Select.Option>
                    <Select.Option value="刺痛">刺痛</Select.Option>
                    <Select.Option value="胀痛">胀痛</Select.Option>
                    <Select.Option value="烧灼感">烧灼感</Select.Option>
                </Select>
             </Form.Item>
          </Col>
          <Col span={12}>
             <Form.Item name={['presentIllness', 'severity']} label="程度">
                <Radio.Group>
                    <Radio value="mild">轻度</Radio>
                    <Radio value="moderate">中度</Radio>
                    <Radio value="severe">重度</Radio>
                </Radio.Group>
             </Form.Item>
          </Col>
          <Col span={12}>
             <Form.Item name={['presentIllness', 'durationDetails']} label="持续时间/频率">
                <Input placeholder="持续性/阵发性" />
             </Form.Item>
          </Col>
          <Col span={24}>
             <Form.Item name={['presentIllness', 'factors']} label="缓解/加重因素">
                <Input placeholder="如：进食后加重，休息后缓解" />
             </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* 3. 伴随症状 */}
      <Card type="inner" title="3. 伴随症状 (智能关联)" size="small" style={{ marginBottom: 16 }}>
         {/* 这里未来可以根据 knowledgeData 动态渲染 */}
         <Form.Item name={['presentIllness', 'associatedSymptoms']} label="有无以下症状">
             <Checkbox.Group style={{ width: '100%' }}>
                 <Row>
                     <Col span={6}><Checkbox value="fever">发热</Checkbox></Col>
                     <Col span={6}><Checkbox value="chills">寒战</Checkbox></Col>
                     <Col span={6}><Checkbox value="sweating">出汗</Checkbox></Col>
                     <Col span={6}><Checkbox value="weight_loss">消瘦</Checkbox></Col>
                     <Col span={6}><Checkbox value="nausea">恶心呕吐</Checkbox></Col>
                     <Col span={6}><Checkbox value="diarrhea">腹泻</Checkbox></Col>
                     <Col span={6}><Checkbox value="cough">咳嗽</Checkbox></Col>
                     <Col span={6}><Checkbox value="chest_pain">胸痛</Checkbox></Col>
                 </Row>
             </Checkbox.Group>
         </Form.Item>
         <Form.Item name={['presentIllness', 'associatedSymptomsDetails']} label="伴随症状详细描述">
             <TextArea rows={2} placeholder="描述伴随症状的特点..." />
         </Form.Item>
      </Card>

      {/* 4. 诊治经过 */}
      <Card type="inner" title="4. 诊治经过" size="small" style={{ marginBottom: 16 }}>
          <Form.Item name={['presentIllness', 'treatmentHistory']} label="就诊及用药情况">
             <TextArea rows={3} placeholder="是否到医院就诊？做了什么检查？结果如何？使用了什么药物？效果如何？" />
          </Form.Item>
      </Card>

      {/* 5. 一般情况 */}
      <Card type="inner" title="5. 发病以来一般情况" size="small">
          <Row gutter={16}>
              <Col span={6}>
                  <Form.Item name={['presentIllness', 'general_spirit']} label="精神">
                      <Select><Select.Option value="good">良好</Select.Option><Select.Option value="poor">差</Select.Option></Select>
                  </Form.Item>
              </Col>
              <Col span={6}>
                  <Form.Item name={['presentIllness', 'general_appetite']} label="食欲">
                      <Select><Select.Option value="good">正常</Select.Option><Select.Option value="poor">减退</Select.Option></Select>
                  </Form.Item>
              </Col>
              <Col span={6}>
                  <Form.Item name={['presentIllness', 'general_sleep']} label="睡眠">
                      <Select><Select.Option value="good">正常</Select.Option><Select.Option value="poor">失眠</Select.Option></Select>
                  </Form.Item>
              </Col>
              <Col span={6}>
                  <Form.Item name={['presentIllness', 'general_weight']} label="体重">
                      <Select><Select.Option value="no_change">无变化</Select.Option><Select.Option value="decrease">下降</Select.Option><Select.Option value="increase">增加</Select.Option></Select>
                  </Form.Item>
              </Col>
          </Row>
      </Card>
    </div>
  );
};

export default HPISection;
