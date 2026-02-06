import React, { useEffect, useRef } from 'react';
import { theme } from 'antd';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import type { ChatMessage } from './types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, type: 'text' | 'voice' | 'image') => void;
  loading?: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, loading }) => {
  const { token } = theme.useToken();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: token.colorBgLayout,
      borderRight: `1px solid ${token.colorBorderSecondary}`
    }}>
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '20px 0',
          scrollBehavior: 'smooth'
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 100, color: token.colorTextSecondary }}>
            开始问诊对话...
          </div>
        )}
        {messages.map(msg => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
      </div>
      <ChatInput onSend={onSendMessage} loading={loading} />
    </div>
  );
};

export default ChatPanel;
