import React from 'react';
import { Typography, Collapse, Tag, Empty, Spin } from 'antd';
import { BulbOutlined, QuestionCircleOutlined, MedicineBoxOutlined, LoadingOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * KnowledgePanelProps
 * 知识库助手属性：包含当前激活分节，已识别的症状上下文，以及加载状态
 */
interface KnowledgePanelProps {
  activeSection: string;
  loading?: boolean;
  symptomContext?: {
    name: string;
    questions?: string[];
    relatedSymptoms?: string[];
    redFlags?: string[];
    physicalSigns?: string[];
  };
}

/**
 * KnowledgePanel
 * 右侧知识库助手：根据当前有效症状，提示警惕征象、必问问题、常见鉴别，
 * 并统一渲染各系统常见症状的问诊要点
 */
const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
  activeSection,
  loading = false,
  symptomContext
}) => {
  
  // 移除未使用的 symptomSummaryData 以通过 linter
  
  const summaryPoints = [
    '症状发生时间、起病方式',
    '部位、性质、程度',
    '频率/持续时间、发作或缓解因素',
    '量、色、味等定量或特征描述',
    '与其他症状之间的关系'
  ];
  
  const imageBasedHints = [
    {
      group: '全身症状',
      items: [
        { name: '发热', points: ['程度', '热型', '有无寒战/盗汗', '与其他症状的关系'] },
        { name: '食欲下降', points: ['程度', '加重或缓解因素', '与其他症状关系'] },
        { name: '多饮/多尿', points: ['每日饮水/尿量', '颜色', '加重或缓解因素'] },
        { name: '消瘦(体重下降)', points: ['下降幅度', '发生时间', '伴随症状', '诱因'] },
        { name: '水肿', points: ['部位', '程度', '对称性', '是否凹陷性水肿'] },
        { name: '黄疸', points: ['程度', '皮肤巩膜颜色变化', '是否瘙痒', '尿色'] },
        { name: '皮疹', points: ['部位', '形状/颜色', '数目', '是否瘙痒', '是否向外扩展'] },
        { name: '皮下结节', points: ['部位', '大小/数量', '质地', '是否疼痛'] },
        { name: '淋巴结肿大', points: ['部位', '大小/数目', '质地', '是否疼痛', '是否进行性增大'] },
        { name: '外伤', points: ['受伤原因', '受伤时间', '部位', '程度'] }
      ]
    },
    {
      group: '头颈部症状',
      items: [
        { name: '头痛', points: ['部位', '性质', '程度', '持续时间', '加重或缓解因素'] },
        { name: '眩晕/头晕', points: ['类型(旋转/头重脚轻)', '诱发因素', '伴随症状', '持续时间'] },
        { name: '抽搐/惊厥', points: ['发作形式', '持续时间', '诱因', '发作后状态'] },
        { name: '昏迷', points: ['起病时间', '诱因', '伴随症状', '病程变化'] },
        { name: '意识障碍', points: ['具体表现', '程度', '持续时间', '加重缓解因素'] },
        { name: '语言障碍', points: ['起病方式', '是否伴面瘫/吞咽困难', '演变过程'] },
        { name: '吞咽困难', points: ['固体/液体', '疼痛', '异物感', '与体位/活动的关系'] },
        { name: '颈痛', points: ['部位', '性质', '放射痛', '加重因素'] },
        { name: '呕吐', points: ['频率', '性质', '量', '与饮食关系', '是否喷射性'] }
      ]
    },
    {
      group: '胸部症状',
      items: [
        { name: '心悸', points: ['性质(间歇/持续)', '发作时机', '程度', '持续时间', '是否突发', '与活动/情绪关系'] },
        { name: '胸痛', points: ['部位', '性质', '程度', '持续时间', '是否放射', '加重缓解因素'] },
        { name: '胸闷', points: ['起病时间', '诱因', '伴随症状', '与体位或活动关系'] },
        { name: '咳嗽', points: ['性质(干/有痰)', '频率', '持续时间', '加重缓解因素'] },
        { name: '咳痰', points: ['量', '色', '味', '是否粘稠', '是否血痰'] },
        { name: '咯血', points: ['量', '颜色', '伴随症状', '加重诱因'] },
        { name: '呼吸困难', points: ['程度', '起病方式', '与体位/活动关系', '夜间阵发性呼吸困难'] }
      ]
    },
    {
      group: '腹部症状',
      items: [
        { name: '腹痛', points: ['部位', '性质', '程度', '持续时间', '放射痛', '与进食关系', '加重缓解因素'] },
        { name: '腹胀', points: ['起病时间', '持续时间', '伴随症状', '加重缓解因素'] },
        { name: '恶心与呕吐', points: ['频率', '性质', '量', '与饮食关系', '是否喷射性'] },
        { name: '腹泻', points: ['次数/量', '性状', '色/味', '是否含黏液/脓血', '伴随发热/腹痛'] },
        { name: '便秘/大便不畅', points: ['持续时间', '排便困难程度', '伴随症状', '加重缓解因素'] },
        { name: '黑便', points: ['发生时间', '颜色/气味', '是否伴乏力头晕', '加重缓解因素'] }
      ]
    },
    {
      group: '泌尿系统症状',
      items: [
        { name: '血尿', points: ['尿液颜色', '是否全程血尿', '伴随疼痛', '是否有凝血块'] },
        { name: '多尿', points: ['每日总量', '伴随口渴', '夜尿次数', '加重缓解因素'] },
        { name: '少尿/无尿', points: ['每日总量', '持续时间', '伴随水肿', '加重缓解因素'] },
        { name: '尿频/尿急/尿痛', points: ['起病时间', '持续时间', '伴随发热/腰痛', '加重缓解因素'] },
        { name: '尿失禁', points: ['类型(应力/急迫/混合)', '频率', '诱因', '对生活影响'] }
      ]
    },
    {
      group: '运动系统症状',
      items: [
        { name: '颈部疼痛', points: ['部位', '性质', '放射痛', '与体位/活动关系'] },
        { name: '腰背痛', points: ['部位', '性质', '程度', '持续时间', '放射至下肢是否', '伴随麻木/乏力'] },
        { name: '关节痛', points: ['受累关节', '肿胀/红热痛', '晨僵时间', '活动受限程度'] },
        { name: '肌肉痛', points: ['部位', '性质', '诱因(运动/劳累)', '伴随发热/乏力'] }
      ]
    },
    {
      group: '妇产科症状',
      items: [
        { name: '月经异常', points: ['周期/经期', '经量/经色', '痛经', '绝经与否'] },
        { name: '白带异常', points: ['量', '色', '气味', '伴随瘙痒/疼痛'] },
        { name: '妊娠相关症状', points: ['孕周', '是否阴道流血', '腹痛', '胎动变化'] },
        { name: '乳房症状', points: ['肿块', '疼痛', '溢乳', '皮肤改变'] }
      ]
    }
  ];

    const renderGenericSymptomList = () => (
      <Collapse
        ghost
        items={imageBasedHints.map(group => ({
          key: group.group,
          label: group.group,
          children: (
            <div>
              {group.items.map((it) => (
                <div key={it.name} style={{ padding: '8px 0' }}>
                  <div style={{ fontWeight: 600 }}>{it.name}</div>
                  <div style={{ marginTop: 4 }}>
                    {it.points.map((p, idx) => <Tag key={idx} color="geekblue">{p}</Tag>)}
                  </div>
                </div>
              ))}
            </div>
          )
        }))}
      />
    );

  /**
   * renderSymptomHints
   * 当存在有效症状时，渲染红旗（警惕征象）、必问问题、常见鉴别以及通用症状要点
   */
  const renderSymptomHints = () => {
     if (!symptomContext || !symptomContext.name) {
         return (
             <div>
                <div style={{ padding: '0 16px 16px', textAlign: 'center' }}>
                   <Empty description="暂未识别到特定症状，请参考以下通用要点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
                {renderGenericSymptomList()}
             </div>
         );
     }

     const items = [
       {
         key: 'summary',
         label: <span style={{ fontWeight: 'bold' }}><QuestionCircleOutlined /> 症状要点总览</span>,
         children: (
           <ul style={{ margin: 0, paddingLeft: 20 }}>
             {summaryPoints.map((it, idx) => <li key={idx}>{it}</li>)}
           </ul>
         )
       },
       {
        key: 'required',
        label: <span style={{ fontWeight: 'bold' }}><QuestionCircleOutlined /> 必问问题</span>,
        children: (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {(symptomContext.questions || []).map((q, idx) => <li key={idx}>{q}</li>)}
          </ul>
        )
      },
      {
        key: 'physical_signs',
        label: <span style={{ fontWeight: 'bold' }}><MedicineBoxOutlined /> 体征提示</span>,
        children: (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
             {(symptomContext.physicalSigns || []).map((sign, idx) => <li key={idx}>{sign}</li>)}
          </ul>
        )
      },
      {
        key: 'related',
         label: <span style={{ fontWeight: 'bold' }}><BulbOutlined /> 常见鉴别</span>,
         children: (
           <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
             {symptomContext.relatedSymptoms?.map(s => <Tag color="blue" key={s}>{s}</Tag>)}
           </div>
         )
       },
       {
         key: 'groups',
         label: <span style={{ fontWeight: 'bold' }}><BulbOutlined /> 常见症状问诊要点</span>,
         children: renderGenericSymptomList()
       }
     ];

     return (
       <div>
         <div style={{ marginBottom: 16, padding: '12px', background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
           <Title level={5} style={{ marginTop: 0, color: '#0050b3' }}>
             <MedicineBoxOutlined /> 当前症状: {symptomContext.name}
           </Title>
           {symptomContext.redFlags && symptomContext.redFlags.length > 0 && (
             <div style={{ marginTop: 8 }}>
               <Text type="danger" strong>警惕征象 (Red Flags):</Text>
               <ul style={{ paddingLeft: 20, margin: '4px 0', color: '#cf1322' }}>
                 {symptomContext.redFlags.map((flag, idx) => <li key={idx}>{flag}</li>)}
               </ul>
             </div>
           )}
         </div>
         <Collapse defaultActiveKey={['summary', 'required', 'physical_signs', 'groups']} ghost items={items} />
      </div>
    );
  };

  /**
   * renderSymptomSummary
   * 统一渲染“常见症状问诊要点”各系统分组，保持样式一致
   */
  // 已移除未使用的渲染函数以通过 linter 检查
 
  const renderGeneralHints = () => {
    const items = [
      {
        key: '1',
        label: '一般项目问诊要点',
        children: (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>核对患者姓名、年龄、性别</li>
            <li>询问职业时注意与疾病的关联（如粉尘接触）</li>
            <li>籍贯和居住地可能与地方病有关</li>
            <li>确认病史陈述者的可靠性</li>
          </ul>
        )
      }
    ];
    return <Collapse items={items} defaultActiveKey={['1']} ghost />;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div style={{ marginTop: 8, color: '#8c8c8c' }}>正在加载知识库...</div>
        </div>
      );
    }
    
      switch (activeSection) {
          case 'general':
              return renderGeneralHints();
          case 'chief_complaint':
          case 'hpi':
              return renderSymptomHints();
          case 'past_history':
              return (
                  <div>
                    {/* 显示当前症状上下文（如果有），确保红旗征和体征提示在既往史中也可见 */}
                    {symptomContext && symptomContext.name && (
                         <div style={{ marginBottom: 16 }}>
                            <Title level={5}>
                                <MedicineBoxOutlined /> 关联症状提示: {symptomContext.name}
                            </Title>
                            {/* 这里复用 renderSymptomHints，但为了避免过于冗长，用户可以折叠不需要的部分 */}
                            {renderSymptomHints()}
                         </div>
                    )}
                    
                    <Collapse
                        ghost
                        defaultActiveKey={['1']}
                        items={[
                        {
                            key: '1',
                            label: '既往史问诊要点',
                            children: (
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                                <li>慢性病史（高血压/糖尿病）对现病的影响</li>
                                <li>手术史的具体时间及愈合情况</li>
                                <li>过敏史必须详细记录过敏原及反应类型</li>
                            </ul>
                            )
                        }
                        ]}
                    />
                  </div>
              );
          default:
              return <Empty description="暂无特定提示" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
      }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
            <Title level={4} style={{ margin: 0 }}>知识库助手</Title>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {renderContent()}
        </div>
    </div>
  );
};

export default KnowledgePanel;
