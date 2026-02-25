/**
 * 籍贯选择组件
 * 仅支持到市级，不支持区县级
 * 
 * 使用说明：
 * - 输入省份或城市名称每个汉字的拼音首字母进行搜索
 * - 例如：输入"hbs"可搜索到"湖北省"、"湖北省武汉市"等
 * - 大小写不敏感
 */

import React, { useState, useMemo } from 'react';
import { Select, Empty, Tag } from 'antd';
import { EnvironmentOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { searchHukouByFirstLetter, isValidFirstLetterInput } from '../utils/chinaRegions';

interface HukouSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: 'large' | 'middle' | 'small';
  style?: React.CSSProperties;
  disabled?: boolean;
}

const HukouSelect: React.FC<HukouSelectProps> = ({
  value,
  onChange,
  placeholder = '输入首字母搜索籍贯（到市级）',
  size = 'middle',
  style,
  disabled = false,
}) => {
  const [searchText, setSearchText] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchText) {
      return [];
    }
    return searchHukouByFirstLetter(searchText);
  }, [searchText]);

  const handleSearch = (text: string) => {
    setSearchText(text);
  };

  const handleChange = (selectedValue: string) => {
    setSearchText('');
    onChange?.(selectedValue);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape'];
    if (allowedKeys.includes(e.key)) {
      return;
    }
    
    if (!/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
    }
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>市级</Tag>
            {option.matchType === '完全匹配' && (
              <Tag color="green" style={{ fontSize: 10, margin: 0 }}>完全匹配</Tag>
            )}
          </div>
        </div>
      </Select.Option>
    );
  };

  const renderDropdownContent = (menu: React.ReactNode) => (
    <div>
      <div style={{ 
        padding: '8px 12px', 
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: '#fafafa'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InfoCircleOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontSize: 12, color: '#666' }}>
            籍贯仅检索到市级，如"hbs"搜索"湖北省"
          </span>
        </div>
        {searchText && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
            搜索结果: 找到 {filteredOptions.length} 个匹配项
          </div>
        )}
      </div>
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
              如：hbs → 湖北省
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

export default HukouSelect;
