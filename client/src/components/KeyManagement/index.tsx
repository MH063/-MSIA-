/**
 * 密钥管理组件
 * 提供密钥生成、导出、导入、更换等功能
 * 支持服务器同步，实现跨设备访问
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  message,
  Progress,
  Alert,
  Descriptions,
  Space,
  Typography,
  Divider,
  Upload,
  Tag,
  Spin,
} from 'antd';
import {
  KeyOutlined,
  LockOutlined,
  DownloadOutlined,
  UploadOutlined,
  SafetyOutlined,
  CloudSyncOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import { keyManager } from '../../utils/keyManager';
import { checkPasswordStrength, PasswordStrength, getStrengthDescription } from '../../utils/passwordValidator';

const { Text } = Typography;

interface KeyStatus {
  hasKeyPair: boolean;
  hasServerKey: boolean;
  publicKeyFingerprint: string | null;
  createdAt: string | null;
  isLocked: boolean;
  isUnauthorized?: boolean;
}

interface KeyManagementModalProps {
  visible: boolean;
  onClose: () => void;
  onKeyChange?: () => void;
}

export const KeyManagementModal: React.FC<KeyManagementModalProps> = ({
  visible,
  onClose,
  onKeyChange,
}) => {
  const [form] = Form.useForm();
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingServer, setCheckingServer] = useState(true);
  const [mode, setMode] = useState<'status' | 'create' | 'unlock' | 'change' | 'export' | 'import' | 'restore' | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>(PasswordStrength.WEAK);
  const [passwordScore, setPasswordScore] = useState(0);
  const [backupFile, setBackupFile] = useState<File | null>(null);

  useEffect(() => {
    if (visible) {
      loadKeyStatus();
    } else {
      setCheckingServer(true);
      setMode(null);
    }
  }, [visible]);

  const loadKeyStatus = async () => {
    setCheckingServer(true);
    const status = keyManager.getStatus();
    
    // 检查服务器是否有密钥
    let hasServerKey: boolean | 'unauthorized' = false;
    let isUnauthorized = false;
    try {
      const result = await keyManager.checkServerKey();
      if (result === 'unauthorized') {
        isUnauthorized = true;
        hasServerKey = false;
      } else {
        hasServerKey = result;
      }
    } catch {
      // 忽略错误
    }
    
    setKeyStatus({
      ...status,
      hasServerKey: hasServerKey === true,
      isUnauthorized,
    });
    
    // 如果未登录，显示状态页面
    if (isUnauthorized) {
      setMode('status');
    } else if (!status.hasKeyPair && hasServerKey) {
      // 本地没有密钥，但服务器有 -> 显示恢复界面
      setMode('restore');
    } else if (!status.hasKeyPair) {
      // 本地和服务器都没有 -> 显示创建界面
      setMode('create');
    } else {
      setMode('status');
    }
    
    setCheckingServer(false);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    const result = checkPasswordStrength(password);
    setPasswordStrength(result.strength);
    setPasswordScore(result.score);
  };

  const getStrengthColor = (strength: PasswordStrength): string => {
    switch (strength) {
      case PasswordStrength.WEAK:
        return '#ff4d4f';
      case PasswordStrength.FAIR:
        return '#faad14';
      case PasswordStrength.GOOD:
        return '#52c41a';
      case PasswordStrength.STRONG:
        return '#1890ff';
    }
  };

  const handleCreateKeyPair = async (values: { password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    const strengthResult = checkPasswordStrength(values.password);
    if (!strengthResult.isValid) {
      message.error(strengthResult.errors[0]);
      return;
    }

    setLoading(true);
    try {
      await keyManager.generateAndStore(values.password);
      message.success('密钥对创建成功，已同步到服务器');
      await loadKeyStatus();
      onKeyChange?.();
      setMode('status');
      form.resetFields();
    } catch {
      message.error('创建密钥对失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (values: { password: string }) => {
    setLoading(true);
    try {
      const success = await keyManager.unlock(values.password);
      if (success) {
        message.success('解锁成功');
        await loadKeyStatus();
        form.resetFields();
      } else {
        message.error('密码错误');
      }
    } catch {
      message.error('解锁失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 从服务器恢复密钥
   */
  const handleRestoreFromServer = async (values: { password: string }) => {
    setLoading(true);
    try {
      const success = await keyManager.syncFromServer(values.password);
      if (success) {
        message.success('密钥恢复成功！');
        await loadKeyStatus();
        onKeyChange?.();
        form.resetFields();
        setMode('status');
      } else {
        message.error('恢复失败，请检查密码是否正确');
      }
    } catch {
      message.error('恢复失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (values: {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致');
      return;
    }

    const strengthResult = checkPasswordStrength(values.newPassword);
    if (!strengthResult.isValid) {
      message.error(strengthResult.errors[0]);
      return;
    }

    setLoading(true);
    try {
      const success = await keyManager.changePassword(values.oldPassword, values.newPassword);
      if (success) {
        message.success('密码更改成功，已同步到服务器');
        form.resetFields();
        setMode('status');
      } else {
        message.error('原密码错误');
      }
    } catch {
      message.error('密码更改失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportKeyPair = async (values: { password: string }) => {
    setLoading(true);
    try {
      const backupString = await keyManager.exportKeyPair(values.password);
      
      const blob = new Blob([backupString], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `msia-key-backup-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success('密钥备份已下载，请妥善保管');
      form.resetFields();
      setMode('status');
    } catch {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImportKeyPair = async (values: { password: string }) => {
    if (!backupFile) {
      message.error('请选择备份文件');
      return;
    }

    setLoading(true);
    try {
      const content = await backupFile.text();
      const success = await keyManager.importKeyPair(content, values.password);
      if (success) {
        message.success('密钥导入成功，已同步到服务器');
        await loadKeyStatus();
        onKeyChange?.();
        form.resetFields();
        setBackupFile(null);
        setMode('status');
      } else {
        message.error('导入失败，请检查密码是否正确');
      }
    } catch {
      message.error('导入失败，文件格式可能无效');
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () => {
    keyManager.lock();
    loadKeyStatus();
    message.success('密钥已锁定');
  };

  /**
   * 渲染从服务器恢复界面
   */
  const renderRestoreForm = () => (
    <Form form={form} layout="vertical" onFinish={handleRestoreFromServer}>
      <Alert
        type="info"
        title="从服务器恢复密钥"
        description="检测到您在其他设备上创建了加密密钥。请输入加密密码来恢复密钥到本设备。"
        showIcon
        icon={<CloudDownloadOutlined />}
        style={{ marginBottom: 16 }}
      />
      
      <Form.Item
        name="password"
        label="加密密码"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="输入您在其他设备上设置的加密密码" />
      </Form.Item>

      <Alert
        type="warning"
        title="提示"
        description="请输入您在创建密钥时设置的密码。如果忘记密码，将无法恢复密钥。"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Space>
        <Button type="primary" htmlType="submit" loading={loading} icon={<CloudSyncOutlined />}>
          从服务器恢复
        </Button>
        <Button onClick={() => { setMode('create'); form.resetFields(); }}>
          创建新密钥
        </Button>
        <Button onClick={() => { setMode('import'); form.resetFields(); }}>
          从文件导入
        </Button>
      </Space>
    </Form>
  );

  const renderStatus = () => (
    <div>
      {keyStatus?.isUnauthorized ? (
        <Alert
          type="warning"
          title="请先登录"
          description="您需要登录后才能管理密钥。请登录后重试。"
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : !keyStatus?.hasKeyPair ? (
        keyStatus?.hasServerKey ? (
          <Alert
            type="info"
            title="检测到服务器密钥"
            description="您在其他设备上创建了加密密钥，可以从服务器恢复。"
            showIcon
            icon={<CloudSyncOutlined />}
            style={{ marginBottom: 16 }}
            action={
              <Button type="primary" onClick={() => setMode('restore')}>
                恢复密钥
              </Button>
            }
          />
        ) : (
          <Alert
            type="warning"
            title="尚未创建加密密钥"
            description="创建密钥对后，您的敏感数据将被加密存储。请设置一个强密码来保护您的密钥。"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )
      ) : (
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="密钥状态">
            {keyStatus.isLocked ? (
              <Tag color="warning">已锁定</Tag>
            ) : (
              <Tag color="success">已解锁</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="服务器同步">
            {keyStatus.hasServerKey ? (
              <Tag color="success" icon={<CloudSyncOutlined />}>已同步</Tag>
            ) : (
              <Tag color="default">未同步</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="密钥指纹">
            <Text code>{keyStatus.publicKeyFingerprint || '未知'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {keyStatus.createdAt ? new Date(keyStatus.createdAt).toLocaleString() : '未知'}
          </Descriptions.Item>
        </Descriptions>
      )}

      <Divider />

      {!keyStatus?.isUnauthorized && (
        <Space wrap>
          {!keyStatus?.hasKeyPair ? (
            <>
              {keyStatus?.hasServerKey && (
                <Button type="primary" icon={<CloudDownloadOutlined />} onClick={() => setMode('restore')}>
                  从服务器恢复
                </Button>
              )}
              <Button type="primary" icon={<KeyOutlined />} onClick={() => setMode('create')}>
                创建密钥对
              </Button>
            </>
          ) : (
            <>
              {keyStatus.isLocked ? (
                <Button icon={<LockOutlined />} onClick={() => setMode('unlock')}>
                  解锁密钥
                </Button>
              ) : (
                <Button icon={<LockOutlined />} onClick={handleLock}>
                  锁定密钥
                </Button>
              )}
              <Button icon={<KeyOutlined />} onClick={() => setMode('change')}>
                更改密码
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => setMode('export')}>
                导出备份
              </Button>
            </>
          )}
          <Button icon={<UploadOutlined />} onClick={() => setMode('import')}>
            导入密钥
          </Button>
        </Space>
      )}
    </div>
  );

  const renderCreateForm = () => (
    <Form form={form} layout="vertical" onFinish={handleCreateKeyPair}>
      <Alert
        type="info"
        title="创建加密密钥"
        description="请设置一个强密码来保护您的密钥。此密码用于加密存储在您设备上的私钥。密钥将自动同步到服务器，方便您在其他设备上恢复。"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form.Item
        name="password"
        label="加密密码"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="至少12位，包含大小写字母、数字和特殊字符"
          onChange={handlePasswordChange}
        />
      </Form.Item>
      
      <div style={{ marginBottom: 16 }}>
        <Text>密码强度：</Text>
        <Progress
          percent={passwordScore}
          size="small"
          strokeColor={getStrengthColor(passwordStrength)}
          format={() => getStrengthDescription(passwordStrength)}
        />
      </div>
      
      <Form.Item
        name="confirmPassword"
        label="确认密码"
        rules={[{ required: true, message: '请确认密码' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="再次输入密码" />
      </Form.Item>

      <Alert
        type="warning"
        title="重要提示"
        description="请牢记此密码！如果忘记密码，您将无法解密已加密的数据。密钥会自动同步到服务器，换设备登录时输入相同密码即可恢复。"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Space>
        <Button type="primary" htmlType="submit" loading={loading}>
          创建密钥
        </Button>
        <Button onClick={() => { setMode('status'); form.resetFields(); }}>
          取消
        </Button>
      </Space>
    </Form>
  );

  const renderUnlockForm = () => (
    <Form form={form} layout="vertical" onFinish={handleUnlock}>
      <Alert
        type="info"
        title="解锁密钥"
        description="请输入您的加密密码来解锁密钥，以便查看或操作加密数据。"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form.Item
        name="password"
        label="加密密码"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="输入加密密码" />
      </Form.Item>

      <Space>
        <Button type="primary" htmlType="submit" loading={loading}>
          解锁
        </Button>
        <Button onClick={() => { setMode('status'); form.resetFields(); }}>
          取消
        </Button>
      </Space>
    </Form>
  );

  const renderChangePasswordForm = () => (
    <Form form={form} layout="vertical" onFinish={handleChangePassword}>
      <Alert
        type="info"
        title="更改加密密码"
        description="更改密码后，您的私钥将使用新密码重新加密，并自动同步到服务器。"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form.Item
        name="oldPassword"
        label="原密码"
        rules={[{ required: true, message: '请输入原密码' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="输入原密码" />
      </Form.Item>
      
      <Form.Item
        name="newPassword"
        label="新密码"
        rules={[{ required: true, message: '请输入新密码' }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="至少12位，包含大小写字母、数字和特殊字符"
          onChange={handlePasswordChange}
        />
      </Form.Item>
      
      <div style={{ marginBottom: 16 }}>
        <Text>密码强度：</Text>
        <Progress
          percent={passwordScore}
          size="small"
          strokeColor={getStrengthColor(passwordStrength)}
          format={() => getStrengthDescription(passwordStrength)}
        />
      </div>
      
      <Form.Item
        name="confirmPassword"
        label="确认新密码"
        rules={[{ required: true, message: '请确认新密码' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="再次输入新密码" />
      </Form.Item>

      <Space>
        <Button type="primary" htmlType="submit" loading={loading}>
          更改密码
        </Button>
        <Button onClick={() => { setMode('status'); form.resetFields(); }}>
          取消
        </Button>
      </Space>
    </Form>
  );

  const renderExportForm = () => (
    <Form form={form} layout="vertical" onFinish={handleExportKeyPair}>
      <Alert
        type="info"
        title="导出密钥备份"
        description="导出的备份文件包含您的密钥对，请使用密码加密后保存。"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form.Item
        name="password"
        label="备份加密密码"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="输入密码加密备份文件" />
      </Form.Item>

      <Alert
        type="warning"
        title="安全提示"
        description="备份文件包含您的私钥，请勿分享给他人。建议保存到安全的离线存储设备。"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Space>
        <Button type="primary" htmlType="submit" loading={loading} icon={<DownloadOutlined />}>
          导出备份
        </Button>
        <Button onClick={() => { setMode('status'); form.resetFields(); }}>
          取消
        </Button>
      </Space>
    </Form>
  );

  const renderImportForm = () => (
    <Form form={form} layout="vertical" onFinish={handleImportKeyPair}>
      <Alert
        type="info"
        title="导入密钥备份"
        description="从备份文件恢复您的密钥对，并自动同步到服务器。"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form.Item label="选择备份文件">
        <Upload
          beforeUpload={(file) => {
            setBackupFile(file);
            return false;
          }}
          onRemove={() => setBackupFile(null)}
          maxCount={1}
          accept=".txt"
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      </Form.Item>
      
      <Form.Item
        name="password"
        label="备份解密密码"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="输入备份文件的解密密码" />
      </Form.Item>

      <Alert
        type="warning"
        title="注意"
        description="导入新密钥将覆盖当前密钥。如果当前有加密数据，请确保您有相应的解密密钥。"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Space>
        <Button type="primary" htmlType="submit" loading={loading} icon={<UploadOutlined />}>
          导入密钥
        </Button>
        <Button onClick={() => { setMode('status'); form.resetFields(); setBackupFile(null); }}>
          取消
        </Button>
      </Space>
    </Form>
  );

  return (
    <Modal
      title={
        <Space>
          <SafetyOutlined />
          <span>密钥管理</span>
        </Space>
      }
      open={visible && !checkingServer && mode !== null}
      onCancel={onClose}
      footer={null}
      width={500}
      centered
      destroyOnHidden
      transitionName=""
      maskTransitionName=""
    >
      {checkingServer || mode === null ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin description="加载中..." />
        </div>
      ) : (
        <>
          {mode === 'status' && renderStatus()}
          {mode === 'create' && renderCreateForm()}
          {mode === 'unlock' && renderUnlockForm()}
          {mode === 'change' && renderChangePasswordForm()}
          {mode === 'export' && renderExportForm()}
          {mode === 'import' && renderImportForm()}
          {mode === 'restore' && renderRestoreForm()}
        </>
      )}
    </Modal>
  );
};

export default KeyManagementModal;
