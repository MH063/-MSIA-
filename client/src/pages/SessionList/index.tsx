import React, { useEffect, useState } from 'react';
import { App as AntdApp, Table, Button, Space, Typography, Card, Tag, Grid, Checkbox, Pagination, Spin, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EyeOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api, { getApiErrorMessage, unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';

const { Title } = Typography;
const { useBreakpoint } = Grid;

/**
 * 病历列表页
 */
interface Patient {
  id: number;
  name?: string;
  gender?: string;
}

interface SessionListItem {
  id: number;
  status: 'draft' | 'completed' | 'archived' | string;
  patient?: Patient;
  createdAt: string;
}
const SessionList: React.FC = () => {
  const navigate = useNavigate();
  const { modal, message } = AntdApp.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SessionListItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const fetchData = React.useCallback(async (page: number = 1, pageSize: number = 10) => {
    setLoading(true);
    try {
      const res: ApiResponse<{ items: SessionListItem[]; total: number } | { data: { items: SessionListItem[]; total: number } }> = await api.get('/sessions', {
        params: { limit: pageSize, offset: (page - 1) * pageSize }
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
    fetchData(pageCurrent, pageSize);
  }, [fetchData, pageCurrent, pageSize]);
  /**
   * 删除单条会话
   */

  const handleDelete = (id: number) => {
    modal.confirm({
      title: '确认删除该问诊记录?',
      icon: <ExclamationCircleOutlined />,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          console.log('[SessionList] 请求永久删除问诊记录', { id });
          const res: ApiResponse = await api.delete(`/sessions/${id}`);
          if (res.success) {
            message.success('已永久删除');
            fetchData(pageCurrent, pageSize);
          }
        } catch (error: unknown) {
          console.error('[SessionList] 永久删除失败', error);
          message.error(getApiErrorMessage(error, '删除失败'));
        }
      },
    });
  };

  /**
   * handleBulkDelete
   * 批量删除会话，使用 unwrapData 解包双层 data 结构，确保兼容后端 { success, data: { deletedCount } } 响应
   */
  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) return;
    modal.confirm({
      title: `确认批量删除选中的 ${selectedRowKeys.length} 条问诊记录?`,
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复，请谨慎操作。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          console.log('[SessionList] 请求批量永久删除问诊记录', { ids: selectedRowKeys });
          const res: ApiResponse<{ deletedCount: number } | { data: { deletedCount: number } }> = await api.post('/sessions/bulk-delete', { ids: selectedRowKeys });
          if (res?.success) {
            const payload = unwrapData<{ deletedCount: number }>(res);
            const count = payload?.deletedCount ?? 0;
            message.success(`已永久删除${count}条记录`);
            setSelectedRowKeys([]);
            fetchData(pageCurrent, pageSize);
          }
        } catch (error: unknown) {
          console.error('[SessionList] 批量永久删除失败', error);
          message.error(getApiErrorMessage(error, '批量删除失败'));
        }
      },
    });
  };

  const columns: ColumnsType<SessionListItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '患者姓名',
      dataIndex: ['patient', 'name'],
      render: (text: string) => text || '未知',
    },
    {
      title: '性别',
      dataIndex: ['patient', 'gender'],
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: string) => {
        let color = 'default';
        let text = status;
        switch (status) {
          case 'draft': color = 'gold'; text = '草稿'; break;
          case 'completed': color = 'green'; text = '已完成'; break;
          case 'archived': color = 'blue'; text = '已归档'; break;
        }
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: SessionListItem) => (
        <Space size="middle">
          <Button 
            type="primary" 
            ghost 
            icon={<EyeOutlined />} 
            onClick={() => navigate(`/interview/${record.id}`)}
          >
            查看
          </Button>
          <Button 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const statusMeta = React.useCallback((status: string) => {
    if (status === 'draft') return { color: 'gold', text: '草稿' };
    if (status === 'completed') return { color: 'green', text: '已完成' };
    if (status === 'archived') return { color: 'blue', text: '已归档' };
    return { color: 'default', text: status || '未知' };
  }, []);

  const toggleSelected = React.useCallback((id: number) => {
    setSelectedRowKeys((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      <Card styles={{ body: { padding: isMobile ? 12 : 24 } }}>
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? 12 : 0,
            marginBottom: 16,
          }}
        >
          <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>我的病历列表</Title>
          <Space style={isMobile ? { width: '100%', justifyContent: 'space-between' } : undefined}>
            <Button
              danger
              disabled={selectedRowKeys.length === 0}
              icon={<DeleteOutlined />}
              onClick={handleBulkDelete}
            >
              批量删除
            </Button>
            <Button type="primary" onClick={() => navigate('/interview')}>
              新建问诊
            </Button>
          </Space>
        </div>

        {isMobile ? (
          <div>
            {loading ? (
              <div style={{ padding: '18px 0', display: 'flex', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : data.length === 0 ? (
              <Empty description="暂无病历" style={{ padding: '18px 0' }} />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {data.map((record) => {
                  const meta = statusMeta(record.status);
                  const patientName = record.patient?.name || '未知';
                  const gender = record.patient?.gender || '-';
                  const createdAt = dayjs(record.createdAt).format('YYYY-MM-DD HH:mm');
                  const checked = selectedRowKeys.includes(record.id);

                  return (
                    <Card
                      key={record.id}
                      hoverable
                      styles={{ body: { padding: 12 } }}
                      onClick={() => navigate(`/interview/${record.id}`)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                          <Checkbox
                            checked={checked}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelected(record.id)}
                            style={{ marginTop: 2 }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <Typography.Text strong style={{ fontSize: 16 }}>{patientName}</Typography.Text>
                            <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.65)', fontSize: 12 }}>
                              <span>病历ID：{record.id}</span>
                              <span style={{ marginInline: 10 }}>性别：{gender}</span>
                            </div>
                          </div>
                        </div>
                        <Tag color={meta.color} style={{ margin: 0 }}>{meta.text}</Tag>
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
                            查看
                          </Button>
                          <Button
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
                onChange={(page, pageSize) => fetchData(page, pageSize)}
                showSizeChanger
                size="small"
              />
            </div>
          </div>
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            tableLayout="fixed"
            scroll={{ y: 480 }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys as number[]),
            }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: (page, pageSize) => fetchData(page, pageSize),
              showSizeChanger: true
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default SessionList;
