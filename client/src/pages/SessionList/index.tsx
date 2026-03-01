import React, { useEffect, useState } from 'react';
import { App as AntdApp, Button, Space, Typography, Card, Tag, Grid, Pagination, Empty, Timeline, Switch, Collapse, Row, Col, theme, Spin, Popconfirm } from 'antd';
import { DeleteOutlined, EyeOutlined, ExclamationCircleOutlined, PlusOutlined, LockOutlined, UnlockOutlined, ClockCircleOutlined, RollbackOutlined, InboxOutlined, FileTextOutlined, CheckCircleOutlined, EditOutlined, FolderOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api, { getApiErrorMessage, unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import { logger } from '../../utils/logger';
import MarkdownEditor from '../../components/MarkdownEditor';
import KeyManagementModal from '../../components/KeyManagement';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

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
  const [keyManagementVisible, setKeyManagementVisible] = useState(false);

  useEffect(() => {
    localStorage.setItem('privacy_mode', String(isEncrypted));
  }, [isEncrypted]);

  const fetchData = React.useCallback(async (page: number = 1, pageSize: number = 10, status?: string, search?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: pageSize, offset: (page - 1) * pageSize };
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

  const handleUnarchive = async (id: number) => {
    try {
      const res: ApiResponse = await api.patch(`/sessions/${id}`, { status: 'draft' });
      if (res.success) {
        message.success('已恢复为草稿');
        fetchData(pageCurrent, pageSize, viewMode === 'archived' ? 'archived' : undefined, searchTerm);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '恢复失败'));
    }
  };

  const handleArchive = async (id: number) => {
    try {
      const res: ApiResponse = await api.patch(`/sessions/${id}`, { status: 'archived' });
      if (res.success) {
        message.success('已归档');
        fetchData(pageCurrent, pageSize, viewMode === 'archived' ? 'archived' : undefined, searchTerm);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '归档失败'));
    }
  };

  const statusMeta = (status: string) => {
    if (status === 'draft') return { color: '#faad14', bg: '#fffbe6', text: '草稿', icon: <EditOutlined /> };
    if (status === 'completed') return { color: '#52c41a', bg: '#f6ffed', text: '已完成', icon: <CheckCircleOutlined /> };
    if (status === 'archived') return { color: '#1890ff', bg: '#e6f7ff', text: '已归档', icon: <FolderOutlined /> };
    return { color: '#8c8c8c', bg: '#fafafa', text: status || '未知', icon: <FileTextOutlined /> };
  };

  const getEncryptedText = (text: string) => {
    if (!isEncrypted) return text;
    if (!text) return '';
    return text.length > 1 ? text[0] + '*'.repeat(text.length - 1) : '*';
  };

  const handleNoteChange = (id: number, value: string) => {
    setActiveNotes(prev => ({ ...prev, [id]: value }));
  };

  const stats = React.useMemo(() => ({
    completed: data.filter(i => i.status === 'completed').length,
    draft: data.filter(i => i.status === 'draft').length,
    archived: data.filter(i => i.status === 'archived').length,
    thisMonth: data.filter(i => dayjs(i.createdAt).isAfter(dayjs().startOf('month'))).length,
  }), [data]);

  const pageStyles: React.CSSProperties = {
    background: `linear-gradient(135deg, ${token.colorBgLayout} 0%, ${token.colorBgContainer} 100%)`,
    minHeight: '100vh',
  };

  const headerCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 20,
    border: 'none',
    marginBottom: 24,
    boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)',
  };

  const statCardStyle: React.CSSProperties = {
    borderRadius: 16,
    border: 'none',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
  };

  const timelineCardStyle: React.CSSProperties = {
    borderRadius: 16,
    border: 'none',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
  };

  return (
    <div style={pageStyles}>
      <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1400, margin: '0 auto' }}>
        <Card style={headerCardStyle} styles={{ body: { padding: isMobile ? 20 : 32 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ color: '#fff' }}>
              <Title level={2} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>
                {viewMode === 'archived' ? '📦 归档记录管理' : '📋 我的病历'}
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>
                {viewMode === 'archived' ? '管理所有已归档的问诊记录' : '管理所有历史问诊记录与病历档案'}
              </Text>
            </div>
            <Space wrap size={12}>
              <div style={{ 
                background: 'rgba(255,255,255,0.2)', 
                borderRadius: 20, 
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backdropFilter: 'blur(10px)',
              }}>
                <LockOutlined style={{ color: '#fff', fontSize: 14 }} />
                <Text style={{ color: '#fff', fontSize: 13 }}>隐私保护</Text>
                <Switch 
                  size="small"
                  checkedChildren={<LockOutlined />} 
                  unCheckedChildren={<UnlockOutlined />} 
                  checked={isEncrypted} 
                  onChange={setIsEncrypted} 
                />
              </div>
              <Button 
                style={{ 
                  background: viewMode === 'archived' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.2)',
                  color: viewMode === 'archived' ? '#667eea' : '#fff',
                  border: 'none',
                  borderRadius: 10,
                  height: 40,
                  fontWeight: 500,
                  backdropFilter: viewMode === 'archived' ? 'none' : 'blur(10px)',
                }}
                icon={viewMode === 'archived' ? <EyeOutlined /> : <InboxOutlined />}
                onClick={() => setViewMode(viewMode === 'all' ? 'archived' : 'all')}
              >
                {viewMode === 'archived' ? '返回全部记录' : '管理归档记录'}
              </Button>
              {viewMode === 'archived' && data.length > 0 && (
                <Popconfirm
                  title="确定恢复所有归档记录为草稿状态吗？"
                  okText="全部恢复"
                  cancelText="取消"
                  onConfirm={async () => {
                    try {
                      const promises = data.map(item => api.patch(`/sessions/${item.id}`, { status: 'draft' }));
                      await Promise.all(promises);
                      message.success('已恢复所有归档记录');
                      fetchData(pageCurrent, pageSize, 'archived', searchTerm);
                    } catch (error: unknown) {
                      message.error(getApiErrorMessage(error, '恢复失败'));
                    }
                  }}
                >
                  <Button 
                    style={{ 
                      background: 'rgba(255,255,255,0.95)',
                      color: '#52c41a',
                      border: 'none',
                      borderRadius: 10,
                      height: 40,
                      fontWeight: 500,
                    }}
                    icon={<RollbackOutlined />}
                  >
                    全部恢复
                  </Button>
                </Popconfirm>
              )}
              <Button 
                style={{ 
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  height: 40,
                  fontWeight: 500,
                  backdropFilter: 'blur(10px)',
                }}
                icon={<SafetyOutlined />}
                onClick={() => setKeyManagementVisible(true)}
              >
                密钥管理
              </Button>
              <Button 
                type="primary"
                style={{ 
                  background: '#fff',
                  color: '#667eea',
                  border: 'none',
                  borderRadius: 10,
                  height: 40,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                icon={<PlusOutlined />}
                onClick={() => navigate('/interview/new')}
              >
                新建问诊
              </Button>
            </Space>
          </div>
        </Card>

        <KeyManagementModal
          visible={keyManagementVisible}
          onClose={() => setKeyManagementVisible(false)}
        />

        {viewMode === 'archived' && (
          <Card 
            style={{ 
              marginBottom: 20, 
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%)',
              boxShadow: '0 2px 8px rgba(24, 144, 255, 0.1)',
            }}
            styles={{ body: { padding: 16 } }}
          >
            <Space>
              <InboxOutlined style={{ color: '#1890ff', fontSize: 18 }} />
              <Text style={{ color: '#1890ff', fontSize: 14 }}>
                当前显示所有已归档的记录。您可以单独恢复某条记录，或点击"全部恢复"批量恢复。
              </Text>
            </Space>
          </Card>
        )}

        {loading && data.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
            <Spin size="large" />
          </div>
        ) : data.length === 0 ? (
          <Card style={{ borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)' }}>
            <Empty 
              description={<Text style={{ color: token.colorTextSecondary }}>暂无病历记录</Text>}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        ) : (
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card 
                title={
                  <Space>
                    <ClockCircleOutlined style={{ color: '#667eea' }} />
                    <span style={{ fontWeight: 600 }}>最近问诊时间轴</span>
                  </Space>
                }
                style={timelineCardStyle}
                styles={{ body: { padding: isMobile ? 16 : 24 } }}
              >
                <Timeline
                  mode="start"
                  items={data.map((item, index) => {
                    const meta = statusMeta(item.status);
                    const date = dayjs(item.createdAt);
                    const patientName = getEncryptedText(item.patient?.name || '未知患者');

                    return {
                      key: item.id,
                      className: 'timeline-item-custom',
                      title: (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'flex-end',
                          minWidth: 80,
                        }}>
                          <Text strong style={{ fontSize: 14, color: token.colorText }}>{date.format('MM-DD')}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{date.format('YYYY')}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{date.format('HH:mm')}</Text>
                        </div>
                      ),
                      icon: item.status === 'completed' ? (
                        <CheckCircleOutlined style={{ fontSize: '18px', color: '#52c41a', background: '#f6ffed', borderRadius: '50%', padding: 4 }} />
                      ) : item.status === 'archived' ? (
                        <FolderOutlined style={{ fontSize: '18px', color: '#1890ff', background: '#e6f7ff', borderRadius: '50%', padding: 4 }} />
                      ) : (
                        <EditOutlined style={{ fontSize: '18px', color: '#faad14', background: '#fffbe6', borderRadius: '50%', padding: 4 }} />
                      ),
                      content: (
                        <Card
                          size="small"
                          style={{ 
                            marginBottom: 8, 
                            borderRadius: 12,
                            border: '1px solid #f0f0f0',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            transition: 'all 0.3s ease',
                            animation: `fadeInUp 0.4s ease ${index * 0.05}s both`,
                          }}
                          styles={{ body: { padding: 16 } }}
                          hoverable
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Space size={12}>
                              <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: `linear-gradient(135deg, ${meta.bg} 0%, ${meta.color}20 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                {meta.icon}
                              </div>
                              <div>
                                <Text strong style={{ fontSize: 16, display: 'block' }}>{patientName}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>ID: {item.id}</Text>
                              </div>
                            </Space>
                            <Tag 
                              style={{ 
                                borderRadius: 6, 
                                border: 'none',
                                background: meta.bg,
                                color: meta.color,
                                fontWeight: 500,
                                padding: '2px 10px',
                              }}
                            >
                              {meta.text}
                            </Tag>
                          </div>

                          <Collapse
                            ghost
                            size="small"
                            items={[
                              {
                                key: 'notes',
                                label: <Text type="secondary" style={{ fontSize: 13 }}>📝 查看医生备注</Text>,
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
                            <Button 
                              size="small" 
                              icon={<EyeOutlined />} 
                              onClick={() => navigate(`/interview/${item.id}`)}
                              style={{ borderRadius: 8, height: 32 }}
                            >
                              进入详情
                            </Button>
                            {viewMode === 'archived' ? (
                              <Popconfirm
                                title="确定恢复该记录为草稿状态吗？"
                                okText="恢复"
                                cancelText="取消"
                                onConfirm={() => handleUnarchive(item.id)}
                              >
                                <Button 
                                  size="small" 
                                  type="primary"
                                  style={{ 
                                    borderRadius: 8, 
                                    height: 32,
                                    background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                                    border: 'none',
                                  }}
                                  icon={<RollbackOutlined />}
                                >
                                  恢复
                                </Button>
                              </Popconfirm>
                            ) : (
                              item.status !== 'archived' && (
                                <Popconfirm
                                  title="确定归档该记录吗？"
                                  okText="归档"
                                  cancelText="取消"
                                  onConfirm={() => handleArchive(item.id)}
                                >
                                  <Button 
                                    size="small"
                                    style={{ borderRadius: 8, height: 32 }}
                                    icon={<InboxOutlined />}
                                  >
                                    归档
                                  </Button>
                                </Popconfirm>
                              )
                            )}
                            <Popconfirm
                              title="确定删除该记录吗？此操作不可恢复。"
                              okText="删除"
                              cancelText="取消"
                              okType="danger"
                              onConfirm={() => handleDelete(item.id)}
                            >
                              <Button 
                                size="small" 
                                danger
                                style={{ borderRadius: 8, height: 32 }}
                                icon={<DeleteOutlined />}
                              >
                                删除
                              </Button>
                            </Popconfirm>
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
                    style={{ 
                      background: token.colorBgContainer,
                      padding: '12px 20px',
                      borderRadius: 10,
                      display: 'inline-block',
                    }}
                  />
                </div>
              </Card>
            </Col>
            
            <Col xs={24} lg={8}>
              <Card 
                title={
                  <Space>
                    <span style={{ fontSize: 18 }}>📊</span>
                    <span style={{ fontWeight: 600 }}>病历统计</span>
                  </Space>
                }
                style={statCardStyle}
                styles={{ body: { padding: isMobile ? 16 : 24 } }}
              >
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <div style={{ 
                      background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
                      borderRadius: 12,
                      padding: 16,
                      textAlign: 'center',
                    }}>
                      <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a', marginBottom: 8 }} />
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>{stats.completed}</div>
                      <div style={{ fontSize: 12, color: '#52c41a' }}>已完成</div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ 
                      background: 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)',
                      borderRadius: 12,
                      padding: 16,
                      textAlign: 'center',
                    }}>
                      <EditOutlined style={{ fontSize: 24, color: '#faad14', marginBottom: 8 }} />
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#faad14' }}>{stats.draft}</div>
                      <div style={{ fontSize: 12, color: '#faad14' }}>草稿</div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ 
                      background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
                      borderRadius: 12,
                      padding: 16,
                      textAlign: 'center',
                    }}>
                      <FolderOutlined style={{ fontSize: 24, color: '#1890ff', marginBottom: 8 }} />
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1890ff' }}>{stats.archived}</div>
                      <div style={{ fontSize: 12, color: '#1890ff' }}>已归档</div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ 
                      background: 'linear-gradient(135deg, #fff0f6 0%, #ffd6e7 100%)',
                      borderRadius: 12,
                      padding: 16,
                      textAlign: 'center',
                    }}>
                      <ClockCircleOutlined style={{ fontSize: 24, color: '#eb2f96', marginBottom: 8 }} />
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#eb2f96' }}>+{stats.thisMonth}</div>
                      <div style={{ fontSize: 12, color: '#eb2f96' }}>本月新增</div>
                    </div>
                  </Col>
                </Row>

                <div style={{ 
                  marginTop: 20, 
                  padding: 16, 
                  background: token.colorFillAlter, 
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <LockOutlined style={{ color: token.colorTextSecondary }} />
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                    数据已启用端到端加密保护，仅授权医生可查看完整病历信息。
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .timeline-item-custom .ant-timeline-item-content {
          margin-inline-start: 24px !important;
        }
        
        .ant-timeline-item-tail {
          border-left-style: dashed !important;
        }
        
        .ant-card:hover {
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
        }
      `}</style>
    </div>
  );
};

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
  summary?: string;
}

export default SessionList;
