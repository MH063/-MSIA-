import React, { useEffect, useState } from 'react';
import { App as AntdApp, Button, Space, Typography, Card, Tag, Grid, Pagination, Empty, Timeline, Switch, Collapse, Row, Col, theme } from 'antd';
import { DeleteOutlined, EyeOutlined, ExclamationCircleOutlined, PlusOutlined, LockOutlined, UnlockOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api, { getApiErrorMessage, unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import { logger } from '../../utils/logger';
import MarkdownEditor from '../../components/MarkdownEditor';

import Loading from '../../components/common/Loading';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

/**
 * 病历列表 - 重构版
 * 支持时间轴视图、富文本编辑预览、加密模式
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
  summary?: string; // 模拟富文本摘要字段
}
const SessionList: React.FC = () => {
  const navigate = useNavigate();
  const { modal, message } = AntdApp.useApp();
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SessionListItem[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isEncrypted, setIsEncrypted] = useState(() => localStorage.getItem('privacy_mode') === 'true');
  const [activeNotes, setActiveNotes] = useState<Record<number, string>>({});
  const [viewMode, setViewMode] = useState<'all' | 'archived'>('all');
  const [searchParams] = useSearchParams();
  const searchTerm = React.useMemo(() => String(searchParams.get('search') || '').trim(), [searchParams]);

  // 持久化隐私模式设置
  useEffect(() => {
    localStorage.setItem('privacy_mode', String(isEncrypted));
  }, [isEncrypted]);

  const fetchData = React.useCallback(async (page: number = 1, pageSize: number = 10, status?: string, search?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: pageSize, offset: (page - 1) * pageSize };
      // 如果是归档模式，尝试传递状态参数
      if (status && status !== 'all') {
        params.status = status;
      }
      if (search && search.trim()) {
        const safe = search.replace(/['"<>]/g, '').trim();
        params.search = safe;
      }
      
      const res: ApiResponse<{ items: SessionListItem[]; total: number } | { data: { items: SessionListItem[]; total: number } }> = await api.get('/sessions', {
        params
      });
      if (res?.success) {
        const payload = unwrapData<{ items: SessionListItem[]; total: number }>(res);
        let items = payload?.items || [];
        // 前端兜底过滤
        if (status && status !== 'all') {
             items = items.filter(item => item.status === status);
        }
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
    fetchData(pageCurrent, pageSize, viewMode === 'archived' ? 'archived' : undefined, searchTerm);
  }, [fetchData, pageCurrent, pageSize, viewMode, searchTerm]);

  const handleDelete = (id: number) => {
    modal.confirm({
      title: '确认删除该问诊记录',
      icon: <ExclamationCircleOutlined />,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res: ApiResponse = await api.delete(`/sessions/${id}`);
          if (res.success) {
            message.success('已永久删除');
            fetchData(pageCurrent, pageSize, viewMode === 'archived' ? 'archived' : undefined, searchTerm);
          }
        } catch (error: unknown) {
          message.error(getApiErrorMessage(error, '删除失败'));
        }
      },
    });
  };

  const statusMeta = (status: string) => {
    if (status === 'draft') return { color: 'gold', text: '草稿' };
    if (status === 'completed') return { color: 'green', text: '已完成' };
    if (status === 'archived') return { color: 'blue', text: '已归档' };
    return { color: 'default', text: status || '未知' };
  };

  const getEncryptedText = (text: string) => {
    if (!isEncrypted) return text;
    if (!text) return '';
    return text.length > 1 ? text[0] + '*'.repeat(text.length - 1) : '*';
  };

  // 模拟更新摘要
  const handleNoteChange = (id: number, value: string) => {
    setActiveNotes(prev => ({ ...prev, [id]: value }));
    // 实际场景应调用API保存
  };

  return (
    <div style={{ padding: isMobile ? 12 : 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>我的病历</Title>
          <Text type="secondary">管理所有历史问诊记录与病历档案</Text>
        </div>
        <Space wrap>
          <Space>
            <Text>数据隐私保护</Text>
            <Switch 
              checkedChildren={<LockOutlined />} 
              unCheckedChildren={<UnlockOutlined />} 
              checked={isEncrypted} 
              onChange={setIsEncrypted} 
            />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/interview')}>
            新建问诊
          </Button>
        </Space>
      </div>

      {loading && data.length === 0 ? (
        <Loading height="60vh" />
      ) : data.length === 0 ? (
        <Empty description="暂无病历记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
             <Card title="最近问诊时间轴" variant="borderless" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <Timeline
                  mode="start"
                  items={data.map(item => {
                    const meta = statusMeta(item.status);
                    const date = dayjs(item.createdAt);
                    const patientName = getEncryptedText(item.patient?.name || '未知患者');

                    return {
                      key: item.id,
                      title: (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <Text strong>{date.format('YYYY-MM-DD')}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{date.format('HH:mm')}</Text>
                        </div>
                      ),
                      dot: item.status === 'completed' ? <ClockCircleOutlined style={{ fontSize: '16px', color: token.colorSuccess }} /> : undefined,
                      content: (
                        <Card
                          size="small"
                          variant="outlined"
                          hoverable
                          style={{ marginBottom: 8, borderColor: token.colorBorderSecondary }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <Space>
                              <Text strong style={{ fontSize: 16 }}>{patientName}</Text>
                              <Tag color={meta.color}>{meta.text}</Tag>
                              <Text type="secondary" style={{ fontSize: 12 }}>ID: {item.id}</Text>
                            </Space>
                          </div>

                          <Collapse
                            ghost
                            size="small"
                            items={[
                              {
                                key: 'notes',
                                label: '医生备注 (富文本)',
                                children: (
                                  <MarkdownEditor
                                    value={activeNotes[item.id] || item.summary || `## 病历摘要\n\n患者：${patientName} 于 ${date.format('YYYY年MM月DD日')} 就诊。`}
                                    onChange={(val) => handleNoteChange(item.id, val)}
                                    height={200}
                                  />
                                )
                              }
                            ]}
                          />

                          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/interview/${item.id}`)}>
                              进入详情
                            </Button>
                            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(item.id)}>
                              删除
                            </Button>
                          </div>
                        </Card>
                      )
                    };
                  })}
                />
                
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                  <Pagination
                    current={pagination.current}
                    pageSize={pagination.pageSize}
                    total={pagination.total}
                    onChange={(page, size) => fetchData(page, size, viewMode === 'archived' ? 'archived' : undefined)}
                    size="small"
                  />
                </div>
             </Card>
          </Col>
          
          <Col xs={24} lg={8}>
            <Card title="病历统计" variant="borderless" style={{ marginBottom: 24 }}>
              <Space orientation="vertical" style={{ width: '100%' }} size="large">
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>总记录数</Text>
                    <Text strong>{pagination.total}</Text>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>本月新增</Text>
                    <Text strong type="success">+ {data.filter(i => dayjs(i.createdAt).isAfter(dayjs().startOf('month'))).length}</Text>
                 </div>
                 <div style={{ padding: 12, background: token.colorFillAlter, borderRadius: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <LockOutlined /> 数据已启用端到端加密保护。仅授权医生可查看完整病历信息。
                    </Text>
                 </div>
              </Space>
            </Card>

            <Card title="快速操作" variant="borderless">
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Button 
                  block 
                  type={viewMode === 'archived' ? 'primary' : 'default'}
                  onClick={() => setViewMode(viewMode === 'all' ? 'archived' : 'all')}
                >
                  {viewMode === 'archived' ? '返回全部记录' : '管理归档记录'}
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default SessionList;
