import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Typography, Card, Modal, message, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EyeOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../utils/api';
import type { ApiResponse } from '../../utils/api';

const { Title } = Typography;
const { confirm } = Modal;

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
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SessionListItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const fetchData = async (page: number = 1, pageSize: number = 10) => {
    setLoading(true);
    try {
      const res: ApiResponse<{ items: SessionListItem[]; total: number }> = await api.get('/sessions', {
        params: { limit: pageSize, offset: (page - 1) * pageSize }
      });
      if (res?.success) {
        const payload = res.data as unknown;
        let items: SessionListItem[] = [];
        let total = 0;
        if (payload && typeof payload === 'object') {
          const obj = payload as { items?: unknown; total?: unknown; data?: unknown };
          const inner = obj.data as { items?: unknown; total?: unknown } | undefined;
          const maybeItems = (obj.items ?? inner?.items) as unknown;
          const maybeTotal = (obj.total ?? inner?.total) as unknown;
          if (Array.isArray(maybeItems)) items = maybeItems as SessionListItem[];
          if (typeof maybeTotal === 'number') total = maybeTotal;
        }
        setData(items);
        setPagination({ current: page, pageSize, total });
      }
    } catch (error) {
      console.error(error);
      message.error('获取列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(pagination.current, pagination.pageSize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /**
   * 删除单条会话
   */

  const handleDelete = (id: number) => {
    confirm({
      title: '确认删除该问诊记录?',
      icon: <ExclamationCircleOutlined />,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res: ApiResponse = await api.delete(`/sessions/${id}`);
          if (res.success) {
            message.success('删除成功');
            fetchData(pagination.current, pagination.pageSize);
          }
        } catch (error) {
          console.error(error);
          message.error('删除失败');
        }
      },
    });
  };

  /**
   * 批量删除会话
   */
  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) return;
    confirm({
      title: `确认批量删除选中的 ${selectedRowKeys.length} 条问诊记录?`,
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复，请谨慎操作。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res: ApiResponse<{ deletedCount: number }> = await api.post('/sessions/bulk-delete', { ids: selectedRowKeys });
          if (res?.success) {
            const count = res?.data?.deletedCount ?? 0;
            message.success(`成功删除 ${count} 条记录`);
            setSelectedRowKeys([]);
            fetchData(pagination.current, pagination.pageSize);
          }
        } catch (error) {
          console.error(error);
          message.error('批量删除失败');
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

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>我的病历列表</Title>
          <Space>
            <Button danger disabled={selectedRowKeys.length === 0} icon={<DeleteOutlined />} onClick={handleBulkDelete}>
              批量删除
            </Button>
            <Button type="primary" onClick={() => navigate('/interview')}>
              新建问诊
            </Button>
          </Space>
        </div>
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
      </Card>
    </div>
  );
};

export default SessionList;
