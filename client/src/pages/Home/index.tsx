import React, { useEffect, useState } from 'react';
import { Button, Typography, Card, Row, Col, Statistic, Avatar, Space, Progress, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  MedicineBoxOutlined, 
  UserOutlined, 
  FileTextOutlined, 
  ClockCircleOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  ScheduleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import api, { unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Paragraph } = Typography;

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  interface Patient { name?: string; gender?: string }
  interface Session { id: number; status: string; patient?: Patient; createdAt: string }
  interface Knowledge { id: number; displayName: string; symptomKey?: string }
  type Stats = {
    todayCount: number;
    completedCount: number;
    archivedCount: number;
    recentSessions: Session[];
    knowledgeCount: number;
    recentKnowledge: Knowledge[];
  };
  const [stats, setStats] = useState<Stats>({
    todayCount: 0,
    completedCount: 0,
    archivedCount: 0,
    recentSessions: [],
    knowledgeCount: 0,
    recentKnowledge: []
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
        console.log('[Home] 获取首页统计数据');
        const res: ApiResponse<Stats | { data: Stats }> = await api.get('/sessions/stats');
        if (res?.success) {
            const payload = unwrapData<Stats>(res);
            if (payload) {
              console.log('[Home] 首页统计数据获取成功', payload);
              setStats(payload);
            }
        }
    } catch (err) {
        console.error('[Home] 首页统计数据获取失败', err);
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'draft':
        return <FileTextOutlined style={{ color: '#faad14' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      draft: '草稿',
      completed: '已完成',
      archived: '已归档'
    };
    return map[status] || status;
  };

  const getStatusTagColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'archived':
        return 'blue';
      case 'draft':
        return 'gold';
      default:
        return 'default';
    }
  };

  const totalDone = stats.archivedCount + stats.completedCount;
  const archivedPercent = totalDone > 0 ? Math.round((stats.archivedCount / totalDone) * 100) : 0;

  return (
    <div className="home-page">
      <Card 
        className="home-banner"
        variant="borderless"
        styles={{ body: { padding: 32 } }}
      >
        <Row align="middle" gutter={[24, 16]} className="home-banner-row">
          <Col xs={24} md={16}>
            <Title level={2} className="home-banner-title">
              欢迎使用医学生智能问诊辅助系统（MSIA）
            </Title>
            <Paragraph className="home-banner-desc">
              今天是 {dayjs().format('YYYY年MM月DD日')}，系统运行正常。准备好开始今天的问诊练习了吗？
            </Paragraph>
          </Col>
          <Col xs={24} md={8}>
            <div className="home-banner-kpis">
              <div className="home-banner-kpi">
                <div className="home-banner-kpi-label">今日已问诊</div>
                <div className="home-banner-kpi-value">{loading ? '—' : stats.todayCount}</div>
              </div>
              <div className="home-banner-kpi">
                <div className="home-banner-kpi-label">系统状态</div>
                <div className="home-banner-kpi-value home-banner-kpi-online">在线</div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 24]}>
        {/* 左侧：核心功能区 */}
        <Col xs={24} lg={16}>
          <Card 
            title={<Space><MedicineBoxOutlined /><span>工作台</span></Space>}
            variant="outlined"
            className="home-card"
          >
            <Row gutter={[24, 24]}>
              <Col span={24}>
                <Card 
                  hoverable
                  className="home-start-card"
                  onClick={() => navigate('/interview/new')}
                >
                  <Row align="middle">
                    <Col flex="1">
                      <div className="home-start-title">开始新问诊</div>
                      <div className="home-start-desc">创建新的标准问诊会话，录入患者信息并开始问诊流程。</div>
                    </Col>
                    <Col>
                      <Button type="primary" size="large" shape="round" icon={<ArrowRightOutlined />}>
                        立即开始
                      </Button>
                    </Col>
                  </Row>
                </Card>
              </Col>
              
              <Col xs={24} md={12}>
                <Card
                  hoverable
                  title="我的病历"
                  className="home-subcard"
                  extra={
                    <Button type="link" onClick={() => navigate('/interview')} style={{ padding: 0 }}>
                      查看全部
                    </Button>
                  }
                >
                  <div className="home-records-top">
                    <div className="home-records-metrics">
                      <div className="home-metric">
                        <div className="home-metric-label">已归档</div>
                        <div className="home-metric-value home-metric-primary">{loading ? '—' : stats.archivedCount}</div>
                      </div>
                      <div className="home-metric">
                        <div className="home-metric-label">已完成</div>
                        <div className="home-metric-value">{loading ? '—' : stats.completedCount}</div>
                      </div>
                    </div>
                    <div className="home-records-progress">
                      <Progress
                        type="dashboard"
                        percent={archivedPercent}
                        size={92}
                        strokeColor={{ '0%': '#52c41a', '100%': '#1677ff' }}
                        railColor="#f0f0f0"
                        format={() => `${archivedPercent}%`}
                      />
                      <div className="home-progress-caption">归档占比</div>
                    </div>
                  </div>
                  {stats.recentSessions && stats.recentSessions.length > 0 ? (
                    <div className="home-list">
                      {stats.recentSessions.slice(0, 3).map((item: Session) => (
                        <div
                          key={item.id}
                          className="home-list-item"
                          onClick={() => navigate(`/interview/${item.id}`)}
                        >
                          <div className="home-list-icon">{getStatusIcon(item.status)}</div>
                          <div className="home-list-main">
                            <div className="home-list-title">
                              <span className="home-patient-name">{item.patient?.name || '未知患者'}</span>
                              <Tag color={getStatusTagColor(item.status)} className="home-status-tag">
                                {getStatusText(item.status)}
                              </Tag>
                            </div>
                            <div className="home-list-subtitle">{dayjs(item.createdAt).fromNow()}</div>
                          </div>
                          <ArrowRightOutlined className="home-list-arrow" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="home-empty">
                      <FileTextOutlined className="home-empty-icon" />
                      <div>暂无病历记录</div>
                    </div>
                  )}
                </Card>
              </Col>
              
              <Col xs={24} md={12}>
                <Card
                  hoverable
                  title="知识库"
                  className="home-subcard"
                  extra={
                    <Button type="link" onClick={() => navigate('/knowledge')} style={{ padding: 0 }}>
                      浏览
                    </Button>
                  }
                >
                  {stats.knowledgeCount > 0 ? (
                    <div className="home-knowledge">
                      <div className="home-knowledge-top">
                        <Statistic
                          title="知识库条目"
                          value={stats.knowledgeCount}
                          loading={loading}
                          styles={{ content: { fontSize: 28, fontWeight: 700 } }}
                        />
                        <div className="home-knowledge-icon">
                          <ScheduleOutlined />
                        </div>
                      </div>
                      <div className="home-knowledge-list">
                        {stats.recentKnowledge.slice(0, 6).map((k: Knowledge) => (
                          <div key={k.id} className="home-knowledge-item" title={k.displayName}>
                            {k.displayName}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="home-empty">
                      <ScheduleOutlined className="home-empty-icon" />
                      <div>知识库暂无内容</div>
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 右侧：状态与通知 */}
        <Col xs={24} lg={8}>
          <Space orientation="vertical" style={{ width: '100%' }} size={24}>
            <Card 
              title={<Space><UserOutlined /><span>值班信息</span></Space>}
              variant="outlined"
              className="home-card"
            >
              <div className="home-duty-header">
                <Avatar size="large" icon={<UserOutlined />} className="home-duty-avatar" />
                <div className="home-duty-user">
                  <div className="home-duty-name">当前用户</div>
                  <div className="home-duty-role">医学生（实习）</div>
                </div>
              </div>
              <div className="home-duty-row">
                <div className="home-duty-label">科室</div>
                <div className="home-duty-value">全科医学</div>
              </div>
              <div className="home-duty-row">
                <div className="home-duty-label">状态</div>
                <div className="home-duty-status">
                  <span className="home-status-dot" />
                  <span>工作中</span>
                </div>
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default Home;
