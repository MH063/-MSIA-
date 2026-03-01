/**
 * 密钥状态提示组件
 * 在需要加密操作时提示用户创建或解锁密钥
 */

import React, { useState, useEffect } from 'react';
import { Alert, Button, Space, Tag, Tooltip } from 'antd';
import {
  SafetyOutlined,
  LockOutlined,
  UnlockOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { keyManager } from '../../utils/keyManager';

interface KeyStatusIndicatorProps {
  onManageKeys?: () => void;
  showDetails?: boolean;
}

interface KeyStatus {
  hasKeyPair: boolean;
  isLocked: boolean;
  hasServerKey: boolean;
}

export const KeyStatusIndicator: React.FC<KeyStatusIndicatorProps> = ({
  onManageKeys,
  showDetails = false,
}) => {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    setLoading(true);
    const status = keyManager.getStatus();
    
    let hasServerKey = false;
    try {
      const result = await keyManager.checkServerKey();
      hasServerKey = result === true;
    } catch {
      // 忽略错误
    }

    setKeyStatus({
      hasKeyPair: status.hasKeyPair,
      isLocked: status.isLocked,
      hasServerKey,
    });
    setLoading(false);
  };

  if (loading) {
    return null;
  }

  // 没有密钥
  if (!keyStatus?.hasKeyPair) {
    return (
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        title="未创建加密密钥"
        description={
          <Space direction="vertical" size="small">
            <span>您的敏感数据需要加密密钥来保护。请先创建密钥。</span>
            {onManageKeys && (
              <Button type="primary" size="small" onClick={onManageKeys}>
                创建密钥
              </Button>
            )}
          </Space>
        }
      />
    );
  }

  // 密钥已锁定
  if (keyStatus.isLocked) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<LockOutlined />}
        title="密钥已锁定"
        description={
          <Space direction="vertical" size="small">
            <span>请解锁密钥以访问加密数据。</span>
            {onManageKeys && (
              <Button type="primary" size="small" onClick={onManageKeys}>
                解锁密钥
              </Button>
            )}
          </Space>
        }
      />
    );
  }

  // 密钥正常
  if (showDetails) {
    return (
      <Space>
        <Tag color="success" icon={<UnlockOutlined />}>密钥已解锁</Tag>
        {keyStatus.hasServerKey && (
          <Tooltip title="密钥已同步到服务器">
            <Tag color="blue" icon={<SafetyOutlined />}>已同步</Tag>
          </Tooltip>
        )}
      </Space>
    );
  }

  return null;
};

/**
 * 紧凑的密钥状态标签
 */
export const KeyStatusTag: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);

  useEffect(() => {
    const status = keyManager.getStatus();
    setKeyStatus({
      hasKeyPair: status.hasKeyPair,
      isLocked: status.isLocked,
      hasServerKey: false,
    });
  }, []);

  if (!keyStatus?.hasKeyPair) {
    return (
      <Tag
        color="warning"
        icon={<WarningOutlined />}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick}
      >
        未创建密钥
      </Tag>
    );
  }

  if (keyStatus.isLocked) {
    return (
      <Tag
        color="processing"
        icon={<LockOutlined />}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick}
      >
        密钥已锁定
      </Tag>
    );
  }

  return (
    <Tag
      color="success"
      icon={<CheckCircleOutlined />}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      密钥已就绪
    </Tag>
  );
};

export default KeyStatusIndicator;
