/**
 * 地区选择组件
 * 仅支持首字母快速检索
 * 
 * 使用说明：
 * - 输入地区名称每个汉字的拼音首字母进行搜索
 * - 例如：输入"hbssys"可搜索到"湖北省十堰市"
 * - 输入"bjs"可搜索到"北京市"
 * - 大小写不敏感
 */

import React, { useState, useMemo } from 'react';
import { Select, Empty, Alert, Tag } from 'antd';
import { EnvironmentOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { searchByFirstLetter, isValidFirstLetterInput } from '../utils/chinaRegions';

interface RegionSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: 'large' | 'middle' | 'small';
  style?: React.CSSProperties;
  disabled?: boolean;
}

/**
 * 地区选择组件
 * 仅支持首字母检索
 */
const RegionSelect: React.FC<RegionSelectProps> = ({
  value,
  onChange,
  placeholder = '输入首字母搜索地区',
  size = 'middle',
  style,
  disabled = false,
}) => {
  const [searchText, setSearchText] = useState('');

  // 根据搜索文本筛选选项（仅首字母检索）
  const filteredOptions = useMemo(() => {
    if (!searchText) {
      return [];
    }
    return searchByFirstLetter(searchText);
  }, [searchText]);

  // 处理搜索
  const handleSearch = (text: string) => {
    setSearchText(text);
  };

  // 处理选择
  const handleChange = (selectedValue: string) => {
    setSearchText('');
    onChange?.(selectedValue);
  };

  // 处理输入验证
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    // 允许功能键（退格、删除、方向键等）
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape'];
    if (allowedKeys.includes(e.key)) {
      return;
    }
    
    // 只允许字母输入
    if (!/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // 自定义下拉选项渲染
  const renderOption = (option: { value: string; label: string; matchType: string }) => {
    const isProvince = !option.value.includes(' - ');
    return (
      <Select.Option 
        key={option.value} 
        value={option.value}
        style={{ 
          fontWeight: isProvince ? 600 : 400,
          paddingLeft: isProvince ? 12 : 24,
          backgroundColor: isProvince ? '#f5f5f5' : 'transparent',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{option.label}</span>
          {option.matchType === '完全匹配' && (
            <Tag color="green" style={{ marginLeft: 8, fontSize: 10 }}>完全匹配</Tag>
          )}
        </div>
      </Select.Option>
    );
  };

  // 渲染下拉内容
  const renderDropdownContent = (menu: React.ReactNode) => (
    <div>
      {/* 使用提示 */}
      <div style={{ 
        padding: '8px 12px', 
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: '#fafafa'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InfoCircleOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontSize: 12, color: '#666' }}>
            仅支持首字母检索，如"hbssys"搜索"湖北省十堰市"
          </span>
        </div>
        {searchText && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
            搜索结果: 找到 {filteredOptions.length} 个匹配项
          </div>
        )}
      </div>
      
      {/* 输入验证提示 */}
      {searchText && !isValidFirstLetterInput(searchText) && (
        <Alert 
          title="请输入纯字母进行首字母检索" 
          type="warning" 
          showIcon 
          style={{ margin: 8, borderRadius: 4 }}
        />
      )}
      
      {/* 搜索结果 */}
      {menu}
    </div>
  );

  return (
    <Select
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      size={size}
      style={{ width: '100%', ...style }}
      disabled={disabled}
      showSearch
      allowClear
      filterOption={false}
      onSearch={handleSearch}
      onBlur={() => {
        setSearchText('');
      }}
      onKeyDown={handleInputKeyDown}
      notFoundContent={
        searchText ? (
          isValidFirstLetterInput(searchText) ? (
            <Empty 
              description={`未找到首字母为"${searchText.toUpperCase()}"的地区`} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Empty 
              description="请输入纯字母进行首字母检索" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
            <EnvironmentOutlined style={{ fontSize: 24, marginBottom: 8, color: '#ccc' }} />
            <div>输入地区名称拼音首字母</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              如：hbssys → 湖北省十堰市
            </div>
          </div>
        )
      }
      suffixIcon={<EnvironmentOutlined />}
      popupRender={renderDropdownContent}
    >
      {filteredOptions.map(option => renderOption(option))}
    </Select>
  );
};

export default RegionSelect;
