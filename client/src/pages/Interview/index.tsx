import React, { useEffect, useState } from 'react';
import { App as AntdApp, Button, Space, Typography, Card, Tag, Tabs, Input, Grid, Pagination, Segmented, Spin, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig, FilterValue, SorterResult, TableCurrentDataSource } from 'antd/es/table/interface';
import { DeleteOutlined, EyeOutlined, ExclamationCircleOutlined, PlusOutlined, FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api, { getApiErrorMessage, unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import LazyTable from '../../components/lazy/LazyTable';
import { logger } from '../../utils/logger';
import './index.css';

const { Title, Text } = Typography;
const { Search } = Input;
const { useBreakpoint } = Grid;

/**
 * Interview Overview Page
 * Displays a list of interview sessions, split by status (Completed/Incomplete).
 */

interface Patient {
  id: number;
  name?: string;
  gender?: string;
  birthDate?: string;
}

interface SessionListItem {
  id: number;
  status: 'draft' | 'completed' | 'archived' | string;
  patient?: Patient;
  createdAt: string;
  updatedAt: string;
}

/**
 * 统计卡片配置接口
 */
interface StatCardConfig {
  key: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  iconClass: string;
}

const InterviewOverview: React.FC = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { modal, message } = AntdApp.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SessionListItem[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [activeTab, setActiveTab] = useState<string>('incomplete');
  const [searchText, setSearchText] = useState<string>('');

  /**
   * 获取问诊列表数据
   */
  const fetchData = React.useCallback(async (page: number = 1, pageSize: number = 10, status: string = 'incomplete', search: string = '') => {
    setLoading(true);
    try {
      const res: ApiResponse<{ items: SessionListItem[]; total: number } | { data: { items: SessionListItem[]; total: number } }> = await api.get('/sessions', {
        params: { 
            limit: pageSize, 
            offset: (page - 1) * pageSize,
            status,
            search
        }
      });
      if (res?.success) {
        const payload = unwrapData<{ items: SessionListItem[]; total: number }>(res);
        const items = payload?.items || [];
        const total = payload?.total || 0;
        setData(items);
        setPagination({ current: page, pageSize, total });
      }
    } catch (error) {
      logger.error(error);
      message.error('获取列表失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const pageCurrent = React.useMemo(() => pagination.current, [pagination]);
  const pageSize = React.useMemo(() => pagination.pageSize, [pagination]);

  useEffect(() => {
    fetchData(pageCurrent, pageSize, activeTab, searchText);
  }, [activeTab, fetchData, pageCurrent, pageSize, searchText]);

  /**
   * 处理表格变化
   */
  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    _sorter: SorterResult<SessionListItem> | SorterResult<SessionListItem>[],
    _extra: TableCurrentDataSource<SessionListItem>
  ) => {
    void _filters;
    void _sorter;
    void _extra;
    const current = pagination.current || 1;
    const pageSize = pagination.pageSize || 10;
    fetchData(current, pageSize, activeTab, searchText);
  };

  /**
   * 处理标签页切换
   */
  const handleTabChange = (key: string) => {
      setActiveTab(key);
      setPagination({ ...pagination, current: 1 });
  };

  /**
   * 处理移动端分段控制器变化
   */
  const handleMobileSegmentChange = (value: string | number) => {
    const key = String(value);
    setActiveTab(key);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  /**
   * 处理搜索
   */
  const handleSearch = (value: string) => {
      setSearchText(value);
      setPagination({ ...pagination, current: 1 });
  };

  /**
   * 处理删除
   */
  const handleDelete = (id: number) => {
    modal.confirm({
      title: '确认删除该问诊记录',
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复，请谨慎操作',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res: ApiResponse = await api.delete(`/sessions/${id}`);
          if (res.success) {
            message.success('已永久删除');
            fetchData(pagination.current, pagination.pageSize, activeTab, searchText);
          }
        } catch (error: unknown) {
          logger.error('[Interview] 永久删除失败', error);
          message.error(getApiErrorMessage(error, '删除失败'));
        }
      },
    });
  };

  /**
   * 获取状态元数据
   */
  const getStatusMeta = React.useCallback((status: SessionListItem['status']) => {
    if (status === 'draft') return { color: 'processing', text: '进行中' };
    if (status === 'completed') return { color: 'success', text: '已完成' };
    if (status === 'archived') return { color: 'green', text: '已归档' };
    return { color: 'default', text: '未知' };
  }, []);

  /**
   * 渲染年龄
   */
  const renderAge = React.useCallback((record: SessionListItem) => {
    if (record.patient?.birthDate) {
      return `${Math.floor(dayjs().diff(dayjs(record.patient.birthDate), 'year'))}岁`;
    }
    return '-';
  }, []);

  /**
   * 统计卡片配置
   */
  const statsCards: StatCardConfig[] = [
    { 
      key: 'total',
      label: '总记录', 
      value: pagination.total, 
      icon: <FileTextOutlined />,
      iconClass: 'interview-stat-icon-blue'
    },
    { 
      key: 'incomplete',
      label: '进行中', 
      value: data.filter(d => d.status === 'draft').length, 
      icon: <SyncOutlined />,
      iconClass: 'interview-stat-icon-orange'
    },
    { 
      key: 'completed',
      label: '已完成', 
      value: data.filter(d => d.status === 'completed' || d.status === 'archived').length, 
      icon: <CheckCircleOutlined />,
      iconClass: 'interview-stat-icon-green'
    },
    { 
      key: 'today',
      label: '今日新增', 
      value: data.filter(d => dayjs(d.createdAt).isSame(dayjs(), 'day')).length, 
      icon: <ClockCircleOutlined />,
      iconClass: 'interview-stat-icon-purple'
    },
  ];

  const columns: ColumnsType<SessionListItem> = [
    {
      title: '患者ID',
      dataIndex: ['patient', 'id'],
      key: 'patientId',
      width: 80,
    },
    {
      title: '姓名',
      dataIndex: ['patient', 'name'],
      key: 'patientName',
      render: (text) => <Typography.Text strong>{text || '未命名'}</Typography.Text>,
    },
    {
      title: '性别',
      dataIndex: ['patient', 'gender'],
      key: 'gender',
      width: 80,
    },
    {
        title: '年龄',
        key: 'age',
        render: (_, record) => renderAge(record),
        width: 80,
    },
    {
      title: '问诊时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const meta = getStatusMeta(status);
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="primary" 
            ghost 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/interview/${record.id}`)}
          >
            {record.status === 'draft' ? '继续问诊' : '查看详情'}
          </Button>
          <Button 
            type="text" 
            danger 
            size="small" 
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="interview-page msia-page">
      {/* 页面头部 */}
      <div className="interview-header">
        <div className="interview-header-content">
          <Title level={isMobile ? 4 : 2} className="interview-title">问诊记录总览</Title>
          <Text className="interview-subtitle">
            管理所有患者的问诊记录，支持按状态筛选与搜索
          </Text>
        </div>
        <div className="interview-header-actions">
          <Button
            type="primary"
            size={isMobile ? 'middle' : 'large'}
            icon={<PlusOutlined />}
            onClick={() => navigate('/interview/new')}
          >
            开始新问诊
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="interview-stats-grid">
        {statsCards.map((card) => (
          <div key={card.key} className="interview-stat-card">
            <div className={`interview-stat-icon ${card.iconClass}`}>
              {card.icon}
            </div>
            <div className="interview-stat-content">
              <div className="interview-stat-value">{card.value}</div>
              <div className="interview-stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 主内容卡片 */}
      <Card className="interview-content-card" variant="borderless">
        {isMobile ? (
          <>
            {/* 移动端筛选 */}
            <div className="interview-mobile-filter">
              <Segmented
                value={activeTab}
                onChange={handleMobileSegmentChange}
                options={[
                  { value: 'incomplete', label: '进行中' },
                  { value: 'completed', label: '已完成' },
                  { value: '', label: '全部' },
                ]}
                block
              />
              <Search
                placeholder="搜索患者姓名"
                allowClear
                onSearch={handleSearch}
              />
            </div>

            {/* 移动端列表 */}
            {loading ? (
              <div className="interview-loading">
                <Spin />
              </div>
            ) : data.length === 0 ? (
              <div className="interview-empty">
                <div className="interview-empty-icon">
                  <FileTextOutlined />
                </div>
                <div className="interview-empty-text">暂无记录</div>
                <div className="interview-empty-hint">点击上方按钮开始新问诊</div>
              </div>
            ) : (
              <div className="interview-mobile-list">
                {data.map((record) => {
                  const statusMeta = getStatusMeta(record.status);
                  const patientName = record.patient?.name || '未命名';
                  const patientId = record.patient?.id ?? '-';
                  const gender = record.patient?.gender || '-';
                  const age = renderAge(record);
                  const createdAt = dayjs(record.createdAt).format('YYYY-MM-DD HH:mm');
                  const actionText = record.status === 'draft' ? '继续问诊' : '查看详情';

                  return (
                    <div
                      key={record.id}
                      className="interview-mobile-card"
                      onClick={() => navigate(`/interview/${record.id}`)}
                    >
                      <div className="interview-mobile-card-header">
                        <div>
                          <div className="interview-mobile-card-name">{patientName}</div>
                          <div className="interview-mobile-card-meta">
                            <span>ID: {patientId}</span>
                            <span>{gender}</span>
                            <span>{age}</span>
                          </div>
                        </div>
                        <Tag color={statusMeta.color} style={{ margin: 0 }}>{statusMeta.text}</Tag>
                      </div>

                      <div className="interview-mobile-card-footer">
                        <span className="interview-mobile-card-time">{createdAt}</span>
                        <Space size={8}>
                          <Button
                            type="primary"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/interview/${record.id}`);
                            }}
                          >
                            {actionText}
                          </Button>
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(record.id);
                            }}
                          >
                            删除
                          </Button>
                        </Space>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 移动端分页 */}
            <div className="interview-pagination">
              <span className="interview-pagination-total">共 {pagination.total} 条记录</span>
              <Pagination
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onChange={(page, pageSize) => fetchData(page, pageSize, activeTab, searchText)}
                showSizeChanger
                size="small"
              />
            </div>
          </>
        ) : (
          <>
            {/* 桌面端筛选栏 */}
            <div className="interview-filter-bar">
              <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                items={[
                  { key: 'incomplete', label: '未完成问诊（进行中）' },
                  { key: 'completed', label: '已完成问诊（归档/结束）' },
                  { key: '', label: '全部记录' }
                ]}
              />
              <div className="interview-search">
                <Search
                  placeholder="搜索患者姓名"
                  allowClear
                  onSearch={handleSearch}
                />
              </div>
            </div>

            {/* 桌面端表格 */}
            <div className="interview-table-wrapper">
              <LazyTable
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                pagination={{
                  ...pagination,
                  showTotal: (total: number) => `共 ${total} 条记录`,
                  showSizeChanger: true
                }}
                onChange={handleTableChange}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default InterviewOverview;
