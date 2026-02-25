import React from 'react';
import { Typography, theme, Alert, Progress } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAssistantStore } from '../../../../store/assistant.store';

const { Text, Title } = Typography;

const ValidationTab: React.FC = () => {
  const { token } = theme.useToken();
  const panel = useAssistantStore(s => s.panel);
  const progressPercent = useAssistantStore(s => s.progressPercent);

  const getProgressColor = (percent: number): string => {
    if (percent >= 80) return token.colorSuccess;
    if (percent >= 50) return token.colorWarning;
    return token.colorError;
  };

  const progressColor = getProgressColor(progressPercent);

  // 聚合所有校验相关的提示
  const omissions = [
    ...(panel.omissions || []),
    ...(panel.pendingItems || []),
  ].filter(Boolean);

  const validationMessages = [
    panel.validationText,
    panel.hpiCareValidationTip,
    panel.maritalValidation,
  ].filter(Boolean) as string[];

  const hasIssues = omissions.length > 0 || validationMessages.length > 0;

  return (
    <div style={{ padding: '0 12px' }}>
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <Progress 
          type="circle" 
          percent={progressPercent} 
          size={80} 
          strokeColor={progressColor}
          railColor={token.colorFillSecondary}
        />
        <div style={{ marginTop: 8, color: token.colorTextSecondary }}>问诊完整度</div>
      </div>

      {!hasIssues ? (
        <Alert
          title="当前信息基本完整"
          description="系统暂未发现明显的缺漏项，请继续保持。"
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
        />
      ) : (
        <>
          {omissions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ fontSize: 14, marginBottom: 12, color: token.colorError }}>
                <ExclamationCircleOutlined style={{ marginRight: 8 }} />
                缺失项提醒
              </Title>
              <div style={{ background: token.colorErrorBg, borderRadius: 8, padding: '4px 8px' }}>
                {omissions.map((item, idx) => (
                  <div key={idx} style={{ padding: '4px 0' }}>
                    <Text type="secondary">• {item}</Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          {validationMessages.length > 0 && (
            <div>
              <Title level={5} style={{ fontSize: 14, marginBottom: 12 }}>
                <ExclamationCircleOutlined style={{ color: token.colorWarning, marginRight: 8 }} />
                校验反馈
              </Title>
              <div>
                {validationMessages.map((item, idx) => (
                  <div key={idx} style={{ padding: '8px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                    <Text>{item}</Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ValidationTab;
