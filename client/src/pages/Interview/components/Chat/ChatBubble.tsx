import React from 'react';
import { Avatar, Space, Typography, theme } from 'antd';
import { UserOutlined, RobotOutlined, SoundOutlined, PictureOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ChatMessage } from './types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface ChatBubbleProps {
  message: ChatMessage;
}

/**
 * 聊天气泡组件
 * 展示文本、语音与图片消息
 */
const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const { token } = theme.useToken();
  const isUser = message.role === 'user';
  
  const bubbleStyle: React.CSSProperties = {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '12px',
    backgroundColor: isUser ? token.colorPrimary : token.colorFillSecondary,
    color: isUser ? '#fff' : token.colorText,
    borderTopRightRadius: isUser ? '2px' : '12px',
    borderTopLeftRadius: isUser ? '12px' : '2px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
  };

  const renderContent = () => {
    if (message.type === 'voice') {
      return (
        <Space>
          <SoundOutlined />
          <Text style={{ color: isUser ? '#fff' : 'inherit' }}>
            语音消息 {message.metadata?.voiceDuration}s
          </Text>
        </Space>
      );
    }
    if (message.type === 'image') {
      return (
        <Space orientation="vertical">
          <PictureOutlined />
          <img 
            src={message.metadata?.imageUrl} 
            alt="Uploaded" 
            style={{ maxWidth: '200px', borderRadius: '8px' }} 
          />
        </Space>
      );
    }
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</div>;
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16,
      alignItems: 'flex-start',
      gap: 8,
      padding: '0 12px'
    }}>
      {!isUser && (
        <Avatar 
          icon={<RobotOutlined />} 
          style={{ backgroundColor: token.colorSuccess, flexShrink: 0 }} 
        />
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <div style={bubbleStyle}>
          {renderContent()}
        </div>
        <Space size={4} style={{ marginTop: 4, fontSize: 12, color: token.colorTextSecondary }}>
          {dayjs(message.timestamp).format('HH:mm')}
          {isUser && message.status === 'sending' && <LoadingOutlined />}
        </Space>
      </div>

      {isUser && (
        <Avatar 
          icon={<UserOutlined />} 
          style={{ backgroundColor: token.colorPrimary, flexShrink: 0 }} 
        />
      )}
    </div>
  );
};

export default ChatBubble;
