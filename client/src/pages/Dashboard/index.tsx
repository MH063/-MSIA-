import React, { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Card, Col, Grid, Progress, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { BarChartOutlined, CalendarOutlined, FileTextOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type DailyCount = { date: string; count: number };

type DashboardStats = {
  todayCount: number;
  completedCount: number;
  archivedCount: number;
  totalSessions?: number;
  totalPatients?: number;
  statusCounts?: Record<string, number>;
  last7DaysSessions?: DailyCount[];
  last7DaysCompleted?: DailyCount[];
  recentSessions: Array<{ id: number; status: string; createdAt: string; patient?: { name?: string; gender?: string } }>;
  knowledgeCount: number;
  recentKnowledge: Array<{ id: number; displayName: string; symptomKey?: string }>;
};

const statusText = (status: string) => {
  const map: Record<string, string> = { draft: '草稿', completed: '已完成', archived: '已归档' };
  return map[status] || status;
};

const statusTagColor = (status: string) => {
  if (status === 'completed') return 'green';
  if (status === 'archived') return 'blue';
  if (status === 'draft') return 'gold';
  return 'default';
};

const Dashboard: React.FC = () => {
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todayCount: 0,
    completedCount: 0,
    archivedCount: 0,
    recentSessions: [],
    knowledgeCount: 0,
    recentKnowledge: [],
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      console.log('[Dashboard] 获取统计数据');
      const res: ApiResponse<DashboardStats | { data: DashboardStats }> = await api.get('/sessions/stats');
      if (res?.success) {
        const payload = unwrapData<DashboardStats>(res);
        if (payload) {
          console.log('[Dashboard] 统计数据获取成功', payload);
          setStats(payload);
        }
      }
    } catch (err) {
      console.error('[Dashboard] 统计数据获取失败', err);
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpiCols = useMemo(() => {
    const span = screens.md ? 6 : 12;
    return {
      totalPatients: span,
      totalSessions: span,
      todayCount: span,
      completedCount: span,
      archivedCount: span,
    };
  }, [screens.md]);

  const statusItems = useMemo(() => {
    const dict = stats.statusCounts || {};
    const entries = Object.entries(dict).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((acc, [, v]) => acc + (Number(v) || 0), 0);
    return entries.map(([k, v]) => ({
      status: k,
      count: Number(v) || 0,
      percent: total > 0 ? Math.round(((Number(v) || 0) / total) * 100) : 0,
    }));
  }, [stats.statusCounts]);

  const dailyRows = useMemo(() => {
    const sessions = Array.isArray(stats.last7DaysSessions) ? stats.last7DaysSessions : [];
    const completed = Array.isArray(stats.last7DaysCompleted) ? stats.last7DaysCompleted : [];
    const completedMap = new Map(completed.map(it => [it.date, it.count]));
    return sessions.map(it => ({
      key: it.date,
      date: it.date,
      sessions: it.count,
      completed: completedMap.get(it.date) ?? 0,
    }));
  }, [stats.last7DaysSessions, stats.last7DaysCompleted]);

  return (
    <div className="msia-page" style={{ padding: screens.md ? 24 : 12 }}>
      <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space align="center" size={10}>
          <BarChartOutlined style={{ fontSize: 20, color: 'var(--msia-primary)' }} />
          <Title level={3} style={{ margin: 0 }}>数据统计</Title>
        </Space>
        <Space size={12}>
          <Tag icon={<CalendarOutlined />} color="blue">{dayjs().format('YYYY年MM月DD日')}</Tag>
        </Space>
      </Space>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={12} md={kpiCols.totalPatients}>
          <Card className="msia-card" styles={{ body: { padding: 16 } }}>
            <Statistic title="患者总数" value={stats.totalPatients ?? 0} prefix={<TeamOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col xs={12} md={kpiCols.totalSessions}>
          <Card className="msia-card" styles={{ body: { padding: 16 } }}>
            <Statistic title="会话总数" value={stats.totalSessions ?? 0} prefix={<FileTextOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col xs={12} md={kpiCols.todayCount}>
          <Card className="msia-card" styles={{ body: { padding: 16 } }}>
            <Statistic title="今日新建会话" value={stats.todayCount} loading={loading} />
          </Card>
        </Col>
        <Col xs={12} md={kpiCols.completedCount}>
          <Card className="msia-card" styles={{ body: { padding: 16 } }}>
            <Statistic title="已完成" value={stats.completedCount} loading={loading} />
          </Card>
        </Col>
        <Col xs={12} md={kpiCols.archivedCount}>
          <Card className="msia-card" styles={{ body: { padding: 16 } }}>
            <Statistic title="已归档" value={stats.archivedCount} loading={loading} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={10}>
          <Card
            className="msia-card"
            title="状态分布"
            extra={<Text type="secondary">按会话状态统计</Text>}
            styles={{ body: { padding: 16 } }}
          >
            {statusItems.length === 0 ? (
              <Text type="secondary">暂无数据</Text>
            ) : (
              <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                {statusItems.map(it => (
                  <div key={it.status} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px', gap: 10, alignItems: 'center' }}>
                    <Tag color={statusTagColor(it.status)} style={{ margin: 0, textAlign: 'center' }}>{statusText(it.status)}</Tag>
                    <Progress percent={it.percent} size="small" showInfo={false} />
                    <Text style={{ textAlign: 'right' }}>{it.count}</Text>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            className="msia-card"
            title="近7日趋势"
            extra={<Text type="secondary">会话与完成数量</Text>}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              size="middle"
              loading={loading}
              pagination={false}
              dataSource={dailyRows}
              columns={[
                {
                  title: '日期',
                  dataIndex: 'date',
                  key: 'date',
                  render: (v: string) => dayjs(v).format('MM月DD日'),
                },
                { title: '会话数', dataIndex: 'sessions', key: 'sessions' },
                { title: '完成数', dataIndex: 'completed', key: 'completed' },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
          <Card
            className="msia-card"
            title="最近会话"
            extra={<Text type="secondary">点击进入详情</Text>}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              size="middle"
              loading={loading}
              pagination={false}
              dataSource={stats.recentSessions.map(s => ({ key: s.id, ...s }))}
              onRow={(record) => ({
                onClick: () => navigate(`/interview/${record.id}`),
              })}
              columns={[
                { title: '患者', dataIndex: ['patient', 'name'], key: 'patient', render: (v?: string) => v || '未知患者' },
                { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusTagColor(v)}>{statusText(v)}</Tag> },
                { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            className="msia-card"
            title="知识库概览"
            extra={<Text type="secondary">最近更新条目</Text>}
            styles={{ body: { padding: 16 } }}
          >
            <Space orientation="vertical" style={{ width: '100%' }} size={10}>
              <Statistic title="知识库总条目" value={stats.knowledgeCount} loading={loading} />
              <div style={{ display: 'grid', gap: 8 }}>
                {stats.recentKnowledge.slice(0, 6).map(k => (
                  <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <Text ellipsis style={{ maxWidth: '70%' }}>{k.displayName}</Text>
                    <Text type="secondary">{k.symptomKey || ''}</Text>
                  </div>
                ))}
                {stats.recentKnowledge.length === 0 && <Text type="secondary">暂无更新记录</Text>}
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
