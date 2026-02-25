/**
 * 出生地/居留地选择组件
 * 支持到区县级，并允许在同一输入框中继续输入乡镇、村等下级行政区划
 * 
 * 规则：
 * - 区县级及以上的内容必须通过首字母检索选择，不能手动输入
 * - 选择地区后，可继续输入详细地址（乡镇/街道/村/社区）
 * 
 * 使用说明：
 * - 输入省份、城市或区县名称每个汉字的拼音首字母进行搜索
 * - 例如：输入"hbssysmjq"可搜索到"湖北省十堰市茅箭区"
 * - 选择地区后，可直接在同一输入框中继续输入详细地址
 * - 大小写不敏感
 */

import React, { useState, useMemo, useRef } from 'react';
import { AutoComplete, Empty, Tag, Space, Typography, Input } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { EnvironmentOutlined, InfoCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { searchBirthplaceByFirstLetter, isValidFirstLetterInput } from '../utils/chinaRegions';

const { TextArea } = Input;

const { Text } = Typography;

interface BirthplaceSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

// 验证是否为有效的地区格式（通过检索选择的地区）
function isValidRegionFormat(value: string): { isValid: boolean; region: string; detail: string } {
  if (!value) {
    return { isValid: false, region: '', detail: '' };
  }
  
  // 地区格式：省份 - 城市 - 区县 详细地址
  // 区县级及以上必须是 "省份 - 城市 - 区县" 格式（通过检索选择）
  const regionMatch = value.match(/^(.+?省|.+?市|.+?自治区|.+?特别行政区)\s*-\s*(.+?市|.+?区|.+?县|.+?自治县|.+?自治州|.+?盟)(?:\s*-\s*(.+?区|.+?县|.+?市|.+?自治县|.+?旗|.+?自治旗))?\s*(.*)$/);
  
  if (regionMatch) {
    const parts: string[] = [];
    if (regionMatch[1]) parts.push(regionMatch[1]);
    if (regionMatch[2]) parts.push(regionMatch[2]);
    if (regionMatch[3]) parts.push(regionMatch[3]);
    return { 
      isValid: true, 
      region: parts.join(' - '), 
      detail: regionMatch[4] || '' 
    };
  }
  
  // 只有省份的情况
  const provinceMatch = value.match(/^(.+?省|.+?市|.+?自治区|.+?特别行政区)\s*(.*)$/);
  if (provinceMatch && !provinceMatch[2]) {
    return { isValid: true, region: provinceMatch[1], detail: '' };
  }
  
  return { isValid: false, region: '', detail: '' };
}

const BirthplaceSelect: React.FC<BirthplaceSelectProps> = ({
  value,
  onChange,
  placeholder = '输入首字母搜索地区，选择后可继续输入详细地址',
  style,
  disabled = false,
}) => {
  const [searchText, setSearchText] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<TextAreaRef>(null);

  // 解析 value，分离地区和详细地址（使用 useMemo 避免在 effect 中调用 setState）
  const parsedValue = useMemo(() => {
    if (!value) {
      return { region: '', detail: '' };
    }
    const parsed = isValidRegionFormat(value);
    return parsed.isValid ? { region: parsed.region, detail: parsed.detail } : { region: '', detail: '' };
  }, [value]);
  
  const selectedRegion = parsedValue.region;
  const detailAddress = parsedValue.detail;

  // 根据搜索文本筛选选项
  const filteredOptions = useMemo(() => {
    if (!searchText || !isValidFirstLetterInput(searchText)) {
      return [];
    }
    return searchBirthplaceByFirstLetter(searchText);
  }, [searchText]);

  // 处理输入变化
  const handleInputChange = (inputValue: string) => {
    // 如果输入为空，允许清空
    if (!inputValue) {
      setSearchText('');
      setIsDropdownOpen(false);
      onChange?.('');
      return;
    }
    
    // 如果已有选择的地区
    if (selectedRegion) {
      // 检查输入是否以选中的地区开头（允许添加详细地址）
      if (inputValue.startsWith(selectedRegion)) {
        // 提取详细地址部分并更新
        onChange?.(inputValue);
        return;
      }
      
      // 检查输入是否是原地区的子串（用户正在删除地区部分）
      if (selectedRegion.startsWith(inputValue)) {
        // 用户正在删除，如果删除后只剩下一部分，允许清空重新选择
        if (inputValue.length < selectedRegion.length) {
          setSearchText('');
          setIsDropdownOpen(false);
          onChange?.('');
          return;
        }
      }
      
      // 用户修改了地区部分，需要重新选择
      // 检查是否是纯字母输入（开始新的检索）
      if (isValidFirstLetterInput(inputValue)) {
        setSearchText(inputValue);
        setIsDropdownOpen(true);
        onChange?.('');
      } else {
        // 非法输入，不更新
        return;
      }
    } else {
      // 还没有选择地区，只允许输入字母进行检索
      if (isValidFirstLetterInput(inputValue)) {
        setSearchText(inputValue);
        setIsDropdownOpen(true);
        onChange?.('');
      } else {
        // 非法输入，不更新
        return;
      }
    }
  };

  // 处理选择
  const handleSelect = (selectedValue: string) => {
    setSearchText('');
    setIsDropdownOpen(false);
    onChange?.(selectedValue);
    // 聚焦输入框，允许用户继续输入详细地址
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // 处理焦点
  const handleFocus = () => {
    // 如果还没有选择地区，且当前值是纯字母，打开下拉框
    if (!selectedRegion && value && isValidFirstLetterInput(value)) {
      setSearchText(value);
      setIsDropdownOpen(true);
    }
  };

  const handleBlur = () => {
    setSearchText('');
    setIsDropdownOpen(false);
  };

  // 生成选项
  const options = useMemo(() => {
    if (!isValidFirstLetterInput(searchText) || filteredOptions.length === 0) {
      return [];
    }
    
    return filteredOptions.map(option => {
      const parts = option.value.split(' - ');
      const isProvince = parts.length === 1;
      const isCity = parts.length === 2;
      const isDistrict = parts.length === 3;
      
      let levelTag = '';
      if (isProvince) {
        levelTag = '[省级]';
      } else if (isCity) {
        levelTag = '[市级]';
      } else if (isDistrict) {
        levelTag = '[区县级]';
      }
      
      return {
        value: option.value,
        label: (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '4px 0'
          }}>
            <span>
              <Text type="secondary" style={{ fontSize: 11, marginRight: 8 }}>{levelTag}</Text>
              {option.label}
            </span>
            {option.matchType === '完全匹配' && (
              <Tag color="green" style={{ fontSize: 10, margin: 0 }}>完全匹配</Tag>
            )}
          </div>
        ),
      };
    });
  }, [searchText, filteredOptions]);

  // 显示值
  const displayValue = selectedRegion 
    ? (detailAddress ? `${selectedRegion} ${detailAddress}` : selectedRegion)
    : (isValidFirstLetterInput(value || '') ? value : '');

  return (
    <div style={{ width: '100%' }}>
      <AutoComplete
        ref={inputRef}
        value={displayValue}
        onChange={handleInputChange}
        onSelect={handleSelect}
        style={{ width: '100%', ...style }}
        disabled={disabled}
        open={isDropdownOpen}
        onFocus={handleFocus}
        onBlur={handleBlur}
        options={options}
        notFoundContent={
          searchText && isValidFirstLetterInput(searchText) ? (
            <Empty 
              description={`未找到首字母为"${searchText.toUpperCase()}"的地区`} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : null
        }
      >
        <TextArea 
          placeholder={placeholder}
          autoSize={{ minRows: 2, maxRows: 4 }}
          suffix={selectedRegion ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <EnvironmentOutlined />}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              setIsDropdownOpen(false);
            }
          }}
        />
      </AutoComplete>
      
      {selectedRegion && (
        <div style={{ 
          marginTop: 4, 
          padding: '4px 8px', 
          backgroundColor: '#f6ffed', 
          borderRadius: 4,
          border: '1px solid #b7eb8f'
        }}>
          <Space size={4}>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {detailAddress 
                ? `完整地址: ${selectedRegion} ${detailAddress}` 
                : `已选择: ${selectedRegion}`
              }
            </Text>
          </Space>
        </div>
      )}
      
      <div style={{ 
        marginTop: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }}>
        <InfoCircleOutlined style={{ color: '#999', fontSize: 12 }} />
        <Text type="secondary" style={{ fontSize: 11 }}>
          {selectedRegion 
            ? '地区已确认，可继续输入详细地址（乡镇/街道/村/社区）'
            : '请输入首字母检索地区（如"hbssysmjq"），区县级必须通过检索选择'
          }
        </Text>
      </div>
    </div>
  );
};

export default BirthplaceSelect;
