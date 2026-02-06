import React, { useState } from 'react';
import { Input, Button, Space, AutoComplete, Tooltip, theme } from 'antd';
import { SendOutlined, AudioOutlined, PictureOutlined } from '@ant-design/icons';
import { useAssistantStore } from '../../../../store/assistant.store';

interface ChatInputProps {
  onSend: (content: string, type: 'text' | 'voice' | 'image') => void;
  loading?: boolean;
}

/**
 * 聊天输入组件
 * 支持自动补全、语音与图片模拟输入
 */
const ChatInput: React.FC<ChatInputProps> = ({ onSend, loading }) => {
  const { token } = theme.useToken();
  const [value, setValue] = useState('');
  const knowledge = useAssistantStore(s => s.knowledge);
  
  // Prepare options from knowledge map
  const options = React.useMemo(() => {
    if (!knowledge?.nameToKey) return [];
    return Object.keys(knowledge.nameToKey).map(name => ({
      value: name,
      label: name
    }));
  }, [knowledge]);

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value, 'text');
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ 
      padding: '12px 16px', 
      borderTop: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorBgContainer 
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <Space orientation="vertical" size={0}>
          <Tooltip title="语音输入 (模拟)">
            <Button 
              shape="circle" 
              icon={<AudioOutlined />} 
              onClick={() => onSend('模拟语音输入...', 'voice')}
            />
          </Tooltip>
          <div style={{ height: 8 }} />
          <Tooltip title="上传图片 (模拟)">
            <Button 
              shape="circle" 
              icon={<PictureOutlined />} 
              onClick={() => onSend('模拟图片上传', 'image')}
            />
          </Tooltip>
        </Space>

        <AutoComplete
          options={options}
          style={{ flex: 1 }}
          value={value}
          onChange={setValue}
          onSelect={(val) => setValue(val)}
          filterOption={(inputValue, option) =>
            option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
          }
        >
          <Input.TextArea 
            placeholder="输入症状或描述，按 Enter 发送..." 
            autoSize={{ minRows: 2, maxRows: 4 }}
            onKeyDown={handleKeyDown}
            style={{ borderRadius: 8, resize: 'none' }}
          />
        </AutoComplete>

        <Button 
          type="primary" 
          shape="circle" 
          icon={<SendOutlined />} 
          size="large"
          onClick={handleSend}
          loading={loading}
          disabled={!value.trim()}
          style={{ marginBottom: 4 }}
        />
      </div>
    </div>
  );
};

export default ChatInput;
