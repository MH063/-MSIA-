import React from 'react';
import { Spin, theme, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface LoadingProps {
  tip?: string;
  fullScreen?: boolean;
  height?: number | string;
  size?: 'small' | 'default' | 'large';
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Loading: React.FC<LoadingProps> = ({ 
  tip = '加载中...', 
  fullScreen = false, 
  height, 
  size = 'large',
  children,
  className,
  style
}) => {
  const { token } = theme.useToken();
  const antIcon = <LoadingOutlined style={{ fontSize: size === 'large' ? 32 : size === 'small' ? 14 : 24 }} spin />;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: fullScreen ? token.colorBgContainer : 'transparent',
    width: '100%',
    height: fullScreen ? '100vh' : (height || '100%'),
    minHeight: fullScreen ? undefined : (height ? undefined : 200),
    position: fullScreen ? 'fixed' : 'relative',
    top: fullScreen ? 0 : undefined,
    left: fullScreen ? 0 : undefined,
    zIndex: fullScreen ? 9999 : undefined,
    ...style
  };

  if (children) {
    return (
      <Spin indicator={antIcon} tip={tip} spinning={true} wrapperClassName={className} style={style}>
        {children}
      </Spin>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <Spin indicator={antIcon} size={size} />
      {tip && (
        <Text style={{ marginTop: 16, color: token.colorTextSecondary }}>
          {tip}
        </Text>
      )}
    </div>
  );
};

export default Loading;
