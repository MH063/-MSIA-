import React, { useState } from 'react';
import { Button, Space, Input, theme } from 'antd';
import { 
  BoldOutlined, 
  ItalicOutlined, 
  UnorderedListOutlined, 
  OrderedListOutlined,
  EyeOutlined,
  EditOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number | string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ 
  value = '', 
  onChange, 
  placeholder = '在此输入内容...', 
  height = 300 
}) => {
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  const insertText = (before: string, after: string = '') => {
    // Simple insertion at end for now, as textarea ref manipulation is complex without refs
    // In a real app, we would use a ref to insert at cursor position
    const newValue = value + before + ' ' + after;
    onChange?.(newValue);
  };

  const toolbar = (
    <Space style={{ padding: '8px', borderBottom: `1px solid ${token.colorBorderSecondary}`, background: token.colorFillQuaternary, width: '100%' }}>
      <Button type="text" size="small" icon={<BoldOutlined />} onClick={() => insertText('**', '**')} title="粗体" />
      <Button type="text" size="small" icon={<ItalicOutlined />} onClick={() => insertText('*', '*')} title="斜体" />
      <Button type="text" size="small" icon={<UnorderedListOutlined />} onClick={() => insertText('\n- ')} title="无序列表" />
      <Button type="text" size="small" icon={<OrderedListOutlined />} onClick={() => insertText('\n1. ')} title="有序列表" />
      <div style={{ width: 1, height: 16, background: token.colorBorder, margin: '0 8px' }} />
      <Button 
        type={activeTab === 'write' ? 'primary' : 'text'} 
        size="small" 
        icon={<EditOutlined />} 
        onClick={() => setActiveTab('write')}
      >
        编辑
      </Button>
      <Button 
        type={activeTab === 'preview' ? 'primary' : 'text'} 
        size="small" 
        icon={<EyeOutlined />} 
        onClick={() => setActiveTab('preview')}
      >
        预览
      </Button>
    </Space>
  );

  return (
    <div style={{ 
      border: `1px solid ${token.colorBorder}`, 
      borderRadius: token.borderRadius, 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: height
    }}>
      {toolbar}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {activeTab === 'write' ? (
          <Input.TextArea 
            value={value} 
            onChange={e => onChange?.(e.target.value)} 
            placeholder={placeholder}
            style={{ 
              border: 'none', 
              boxShadow: 'none', 
              height: '100%', 
              resize: 'none', 
              padding: '12px',
              borderRadius: 0,
              background: token.colorBgContainer
            }} 
          />
        ) : (
          <div style={{ padding: '12px', height: '100%', overflow: 'auto', background: token.colorBgLayout }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {value || '(暂无内容)'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor;
