import React, { useEffect, useState } from 'react';
import { App as AntdApp, Button, Space, Typography, Card, Tag, Tabs, Input, Grid, Pagination, Segmented, Spin, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig, FilterValue, SorterResult, TableCurrentDataSource } from 'antd/es/table/interface';
import { DeleteOutlined, EyeOutlined, ExclamationCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api, { getApiErrorMessage, unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import LazyTable from '../../components/lazy/LazyTable';

const { Title } = Typography;
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

const InterviewOverview: React.FC = () => {
  const navigate = useNavigate();
  const { modal, message } = AntdApp.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SessionListItem[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [activeTab, setActiveTab] = useState<string>('incomplete');
  const [searchText, setSearchText] = useState<string>('');

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
      console.error(error);
      message.error('获取列表失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const pageCurrent = React.useMemo(() => pagination.current, [pagination]);
  const pageSize = React.useMemo(() => pagination.pageSize, [pagination]);

  useEffect(() => {
    fetchData(pageCurrent, pageSize, activeTab, searchText);
  }, [activeTab, fetchData, pageCurrent, pageSize, searchText]); // 仅依赖具体数值，避免对象引用变化导致循环

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

  const handleTabChange = (key: string) => {
      setActiveTab(key);
      setPagination({ ...pagination, current: 1 }); // Reset to page 1
  };

  const handleMobileSegmentChange = (value: string | number) => {
    const key = String(value);
    setActiveTab(key);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleSearch = (value: string) => {
      setSearchText(value);
      setPagination({ ...pagination, current: 1 });
  };

  const handleDelete = (id: number) => {
    modal.confirm({
      title: '确认删除该问诊记录?',
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复，请谨慎操作。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          console.log('[Interview] 请求永久删除问诊记录', { id });
          const res: ApiResponse = await api.delete(`/sessions/${id}`);
          if (res.success) {
            message.success('已永久删除');
            fetchData(pagination.current, pagination.pageSize, activeTab, searchText);
          }
        } catch (error: unknown) {
          console.error('[Interview] 永久删除失败', error);
          message.error(getApiErrorMessage(error, '删除失败'));
        }
      },
    });
  };

  const getStatusMeta = React.useCallback((status: SessionListItem['status']) => {
    if (status === 'draft') return { color: 'processing', text: '进行中' };
    if (status === 'completed') return { color: 'success', text: '已完成' };
    if (status === 'archived') return { color: 'green', text: '已归档' };
    return { color: 'default', text: '未知' };
  }, []);

  const renderAge = React.useCallback((record: SessionListItem) => {
    if (record.patient?.birthDate) {
      return `${Math.floor(dayjs().diff(dayjs(record.patient.birthDate), 'year'))}岁`;
    }
    return '-';
  }, []);

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
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? 12 : 24 }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0, marginBottom: isMobile ? 12 : 24 }}>
        <div>
          <Title level={isMobile ? 4 : 2} style={{ marginBottom: 6 }}>问诊记录总览</Title>
          <Typography.Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
            管理所有患者的问诊记录，支持按状态筛选与搜索
          </Typography.Text>
        </div>
        <Button
          type="primary"
          size={isMobile ? 'middle' : 'large'}
          icon={<PlusOutlined />}
          onClick={() => navigate('/interview/new')}
          style={isMobile ? { width: '100%' } : undefined}
        >
          开始新问诊
        </Button>
      </div>

      <Card variant="borderless" styles={{ body: { padding: isMobile ? 12 : '0 24px 24px 24px' } }}>
        {isMobile ? (
          <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
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
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              items={[
                { key: 'incomplete', label: '未完成问诊 (进行中)' },
                { key: 'completed', label: '已完成问诊 (归档/结束)' },
                { key: '', label: '全部记录' }
              ]}
              style={{ flex: 1 }}
            />
            <div style={{ paddingLeft: 16 }}>
              <Search
                placeholder="搜索患者姓名"
                allowClear
                onSearch={handleSearch}
                style={{ width: 250 }}
              />
            </div>
          </div>
        )}

        {isMobile ? (
          <div>
            {loading ? (
              <div style={{ padding: '18px 0', display: 'flex', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : data.length === 0 ? (
              <Empty description="暂无记录" style={{ padding: '18px 0' }} />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {data.map((record) => {
                  const statusMeta = getStatusMeta(record.status);
                  const patientName = record.patient?.name || '未命名';
                  const patientId = record.patient?.id ?? '-';
                  const gender = record.patient?.gender || '-';
                  const age = renderAge(record);
                  const createdAt = dayjs(record.createdAt).format('YYYY-MM-DD HH:mm');
                  const actionText = record.status === 'draft' ? '继续问诊' : '查看详情';

                  return (
                    <Card
                      key={record.id}
                      styles={{ body: { padding: 12 } }}
                      style={{ width: '100%' }}
                      onClick={() => navigate(`/interview/${record.id}`)}
                      hoverable
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <Typography.Text strong style={{ fontSize: 16 }}>{patientName}</Typography.Text>
                          <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.65)', fontSize: 12 }}>
                            <span>患者ID：{patientId}</span>
                            <span style={{ marginInline: 10 }}>性别：{gender}</span>
                            <span>年龄：{age}</span>
                          </div>
                        </div>
                        <Tag color={statusMeta.color} style={{ margin: 0 }}>{statusMeta.text}</Tag>
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{createdAt}</Typography.Text>
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
                    </Card>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                共 {pagination.total} 条
              </Typography.Text>
              <Pagination
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onChange={(page, pageSize) => fetchData(page, pageSize, activeTab, searchText)}
                showSizeChanger
                size="small"
              />
            </div>
          </div>
        ) : (
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
        )}
      </Card>
    </div>
  );
};

export default InterviewOverview;
