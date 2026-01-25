import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Typography, Card, Modal, message, Tag, Tabs, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig, FilterValue, SorterResult, TableCurrentDataSource } from 'antd/es/table/interface';
import { DeleteOutlined, EyeOutlined, ExclamationCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../utils/api';
import type { ApiResponse } from '../../utils/api';

const { Title } = Typography;
const { confirm } = Modal;
const { Search } = Input;

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
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SessionListItem[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [activeTab, setActiveTab] = useState<string>('incomplete');
  const [searchText, setSearchText] = useState<string>('');

  const fetchData = async (page: number = 1, pageSize: number = 10, status: string = 'incomplete', search: string = '') => {
    setLoading(true);
    try {
      const res: ApiResponse<{ items: SessionListItem[]; total: number }> = await api.get('/sessions', {
        params: { 
            limit: pageSize, 
            offset: (page - 1) * pageSize,
            status,
            search
        }
      });
      if (res?.success) {
        type Payload = { items: SessionListItem[]; total: number };
        const payloadMaybe = res.data as unknown;
        const isDirect = (p: unknown): p is Payload => {
          if (!p || typeof p !== 'object') return false;
          const obj = p as Record<string, unknown>;
          return Array.isArray(obj.items);
        };
        const isNested = (p: unknown): p is { data: Payload } => {
          if (!p || typeof p !== 'object') return false;
          const obj = p as Record<string, unknown>;
          const data = obj.data as Record<string, unknown> | undefined;
          return !!data && Array.isArray(data.items);
        };
        let items: SessionListItem[] = [];
        let total = 0;
        if (isDirect(payloadMaybe)) {
          items = payloadMaybe.items;
          total = payloadMaybe.total || 0;
        } else if (isNested(payloadMaybe)) {
          items = payloadMaybe.data.items;
          total = payloadMaybe.data.total || 0;
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
    fetchData(pagination.current, pagination.pageSize, activeTab, searchText);
  }, [activeTab, searchText]); // Reload when tab or search changes

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

  const handleSearch = (value: string) => {
      setSearchText(value);
      setPagination({ ...pagination, current: 1 });
  };

  const handleDelete = (id: number) => {
    confirm({
      title: '确认删除该问诊记录?',
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复，请谨慎操作。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res: ApiResponse = await api.delete(`/sessions/${id}`);
          if (res.success) {
            message.success('删除成功');
            fetchData(pagination.current, pagination.pageSize, activeTab, searchText);
          }
        } catch (error) {
          console.error(error);
          message.error('删除失败');
        }
      },
    });
  };

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
        render: (_, record) => {
            if (record.patient?.birthDate) {
                return Math.floor(dayjs().diff(dayjs(record.patient.birthDate), 'year')) + '岁';
            }
            return '-';
        },
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
        let color = 'default';
        let text = '未知';
        switch (status) {
          case 'draft':
            color = 'processing';
            text = '进行中';
            break;
          case 'completed':
            color = 'success';
            text = '已完成';
            break;
          case 'archived':
            color = 'green';
            text = '已归档';
            break;
        }
        return <Tag color={color}>{text}</Tag>;
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
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
            <Title level={2}>问诊记录总览</Title>
            <Typography.Text type="secondary">
                管理所有患者的问诊记录，支持按状态筛选与搜索
            </Typography.Text>
        </div>
        <Button 
            type="primary" 
            size="large" 
            icon={<PlusOutlined />}
            onClick={() => navigate('/interview/new')}
        >
            开始新问诊
        </Button>
      </div>

      <Card variant="borderless" styles={{ body: { padding: '0 24px 24px 24px' } }}>
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
       
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
              ...pagination,
              showTotal: (total) => `共 ${total} 条记录`,
              showSizeChanger: true
          }}
          onChange={handleTableChange}
        />
      </Card>
    </div>
  );
};

export default InterviewOverview;
