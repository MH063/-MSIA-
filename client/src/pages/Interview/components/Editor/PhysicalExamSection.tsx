import React from 'react';
import { Form, Input, Row, Col, Typography, Card, InputNumber } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PhysicalExamSection: React.FC = () => {
  return (
    <div className="section-container">
      <Title level={4} style={{ marginBottom: 24 }}>体格检查 (Physical Examination)</Title>
      
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          【系统提示：体格检查应在患者入院后24小时内完成】
        </Text>
      </div>

      {/* 1. 生命体征 */}
      <Card type="inner" title="【生命体征】" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item 
              name={['physicalExam', 'vitalSigns', 'temperature']} 
              label="T (体温, ℃)"
              rules={[{ required: true, message: '请输入体温' }]}
            >
              <InputNumber style={{ width: '100%' }} min={35} max={42} step={0.1} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item 
              name={['physicalExam', 'vitalSigns', 'pulse']} 
              label="P (脉搏, 次/分)"
              rules={[{ required: true, message: '请输入脉搏' }]}
            >
              <InputNumber style={{ width: '100%' }} min={30} max={200} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item 
              name={['physicalExam', 'vitalSigns', 'respiration']} 
              label="R (呼吸, 次/分)"
              rules={[{ required: true, message: '请输入呼吸频率' }]}
            >
              <InputNumber style={{ width: '100%' }} min={10} max={60} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="BP (血压)" style={{ marginBottom: 0 }} required>
               <Row gutter={[8, 8]} align="middle">
                 <Col xs={24} sm={11}>
                    <Form.Item 
                      name={['physicalExam', 'vitalSigns', 'systolicBP']}
                      rules={[{ required: true, message: '收缩压' }]}
                    >
                        <InputNumber style={{ width: '100%' }} placeholder="收缩压" />
                    </Form.Item>
                 </Col>
                 <Col xs={0} sm={2} style={{ textAlign: 'center' }}>/</Col>
                 <Col xs={24} sm={11}>
                    <Form.Item 
                      name={['physicalExam', 'vitalSigns', 'diastolicBP']}
                      rules={[{ required: true, message: '舒张压' }]}
                    >
                        <InputNumber style={{ width: '100%' }} placeholder="舒张压(mmHg)" />
                    </Form.Item>
                 </Col>
               </Row>
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* 2. 一般情况 */}
      <Card type="inner" title="【一般情况】" size="small" style={{ marginBottom: 24 }}>
        <Form.Item name={['physicalExam', 'general', 'description']} label="发育/营养/神志/体位/步态/面容/合作度">
           <TextArea rows={2} placeholder="如：发育正常，营养中等，神志清楚，自主体位，步态正常，面容无特殊，查体合作。" />
        </Form.Item>
        <Form.Item name={['physicalExam', 'skinMucosa']} label="皮肤、粘膜">
           <TextArea rows={1} placeholder="如：皮肤粘膜无黄染，无皮疹、出血点、蜘蛛痣及肝掌。" />
        </Form.Item>
        <Form.Item name={['physicalExam', 'lymphNodes']} label="全身浅表淋巴结">
           <TextArea rows={1} placeholder="如：全身浅表淋巴结未触及肿大。" />
        </Form.Item>
      </Card>

      {/* 3. 头颈部 */}
      <Card type="inner" title="【头部及颈部】" size="small" style={{ marginBottom: 24 }}>
        <Form.Item name={['physicalExam', 'head']} label="头部及其器官">
           <TextArea rows={2} placeholder="如：头颅无畸形，眼睑无水肿，结膜无充血，巩膜无黄染，瞳孔等大等圆，对光反射灵敏。耳鼻无畸形及异常分泌物。口唇无发绀，咽无充血，扁桃体无肿大。" />
        </Form.Item>
        <Form.Item name={['physicalExam', 'neck']} label="颈部">
           <TextArea rows={2} placeholder="如：颈软，无抵抗，气管居中，甲状腺未触及肿大，颈静脉无怒张。" />
        </Form.Item>
      </Card>

      {/* 4. 胸部 */}
      <Card type="inner" title="【胸部】" size="small" style={{ marginBottom: 24 }}>
        <Form.Item name={['physicalExam', 'chest', 'thorax']} label="胸廓">
           <TextArea rows={1} placeholder="如：胸廓对称无畸形，肋间隙无增宽或变窄。" />
        </Form.Item>
        <Form.Item name={['physicalExam', 'chest', 'lungs']} label="肺部">
           <TextArea rows={2} placeholder="如：双肺呼吸音清，未闻及干湿性啰音，无胸膜摩擦音。" />
        </Form.Item>
        <Form.Item name={['physicalExam', 'chest', 'heart']} label="心脏">
           <TextArea rows={2} placeholder="如：心前区无隆起，心尖搏动位于第5肋间左锁骨中线内0.5cm，无震颤。心率80次/分，律齐，各瓣膜听诊区未闻及病理性杂音。" />
        </Form.Item>
      </Card>

      {/* 5. 腹部 */}
      <Card type="inner" title="【腹部】" size="small" style={{ marginBottom: 24 }}>
        <Form.Item name={['physicalExam', 'abdomen']} label="视触叩听">
           <TextArea rows={3} placeholder="如：腹平坦，无胃肠型及蠕动波，腹软，无压痛及反跳痛，肝脾肋下未触及，墨菲氏征阴性，移动性浊音阴性，肠鸣音4次/分。" />
        </Form.Item>
      </Card>

      {/* 6. 其他部位 */}
      <Card type="inner" title="【其他部位及神经系统】" size="small" style={{ marginBottom: 24 }}>
         <Row gutter={24}>
           <Col span={24}>
              <Form.Item name={['physicalExam', 'anusGenitals']} label="肛门、直肠、外生殖器">
                  <Input placeholder="如：未查" />
              </Form.Item>
           </Col>
           <Col span={24}>
              <Form.Item name={['physicalExam', 'spineLimbs']} label="脊柱、四肢">
                  <Input placeholder="如：脊柱生理弯曲存在，无畸形，四肢活动自如，无杵状指（趾），双下肢无水肿。" />
              </Form.Item>
           </Col>
           <Col span={24}>
              <Form.Item name={['physicalExam', 'neurological']} label="神经系统">
                  <Input placeholder="如：生理反射存在，病理反射未引出，脑膜刺激征阴性。" />
              </Form.Item>
           </Col>
         </Row>
      </Card>
    </div>
  );
};

export default PhysicalExamSection;
