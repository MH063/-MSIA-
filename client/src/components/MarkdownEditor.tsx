import React, { useState, useRef, useCallback } from 'react';
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

/**
 * Markdown 编辑器组件
 * 支持工具栏快捷插入和实时预览
 */
const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ 
  value = '', 
  onChange, 
  placeholder = '在此输入内容...', 
  height = 300 
}) => {
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * 在光标位置插入文本
   * 支持选中文本时包裹前后缀
   */
  const insertText = useCallback((before: string, after: string = '') => {
    const textarea = textareaRef.current;
    
    if (!textarea) {
      // 降级处理：在末尾插入
      const newValue = value + before + ' ' + after;
      onChange?.(newValue);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    // 构建新值：光标前 + before + 选中文本 + after + 光标后
    const newValue = value.substring(0, start) + before + selectedText + after + value.substring(end);
    onChange?.(newValue);
    
    // 恢复光标位置和焦点
    setTimeout(() => {
      if (textarea) {
        const newCursorPos = start + before.length + selectedText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }
    }, 0);
  }, [value, onChange]);

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
            ref={textareaRef}
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
