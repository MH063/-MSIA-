import React from 'react';
import { Typography, Empty, theme, Alert } from 'antd';
import { BulbOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAssistantStore } from '../../../../store/assistant.store';

const { Text, Title } = Typography;

const TeachingTab: React.FC = () => {
  const { token } = theme.useToken();
  const panel = useAssistantStore(s => s.panel);
  const moduleLabel = useAssistantStore(s => s.moduleLabel);

  // 聚合所有教学相关的提示
  const tips = [
    ...(panel.tips || []),
    ...(panel.guidance || []),
    panel.geneticRiskTip,
    panel.occupationalExposureTip,
    panel.pregnancyRedFlagsTip,
    panel.conflictTip,
    panel.redFlagsTip,
    panel.weeklyAlcoholHint,
    panel.smokingIndexHint,
    panel.drinkingHint,
  ].filter(Boolean) as string[];

  if (tips.length === 0) {
    return (
      <div style={{ padding: '0 16px 16px', textAlign: 'center' }}>
        <Empty description="当前暂无特定的教学指导，请继续问诊" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 12px' }}>
      <Alert title={`当前阶段：${moduleLabel}`} type="info" showIcon style={{ marginBottom: 16 }} />
      
      <Title level={5} style={{ fontSize: 14, marginBottom: 12 }}>
        <BulbOutlined style={{ color: token.colorWarning, marginRight: 8 }} />
        问诊建议
      </Title>
      
      <div>
        {tips.map((item, index) => (
          <div key={index} style={{ padding: '8px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <InfoCircleOutlined style={{ color: token.colorInfo, marginTop: 4, flexShrink: 0 }} />
              <Text style={{ fontSize: 14 }}>{item}</Text>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeachingTab;
