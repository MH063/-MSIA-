import React, { useEffect, useState } from 'react';
import { Button, Typography, Row, Col, Input, Card, Tag, Skeleton, Statistic, Avatar } from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  SearchOutlined, 
  PlusOutlined, 
  FileTextOutlined, 
  BookOutlined, 
  BarChartOutlined,
  MedicineBoxOutlined,
  ClockCircleOutlined,
  UserOutlined,
  RightOutlined,
  BulbOutlined
} from '@ant-design/icons';
import Lottie from 'lottie-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import api, { unwrapData } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import medicalPulseAnimation from '../../assets/animations/medical-pulse.json';
import './index.css';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;

/**
 * 首页组件
 * 展示常用入口、最近问诊与知识更新，以及当日统计
 */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  interface Patient { name?: string; gender?: string; age?: number }
  interface Session { id: number; status: string; patient?: Patient; createdAt: string; summary?: string }
  interface Knowledge { id: number; displayName: string; symptomKey?: string; category?: string }
  
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
        const res: ApiResponse<Stats | { data: Stats }> = await api.get('/sessions/stats');
        if (res?.success) {
            const payload = unwrapData<Stats>(res);
            if (payload) {
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

  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      draft: { color: 'gold', text: '草稿' },
      completed: { color: 'green', text: '已完成' },
      archived: { color: 'default', text: '已归档' }
    };
    const { color, text } = map[status] || { color: 'default', text: '未知' };
    return <Tag color={color}>{text}</Tag>;
  };

  const quickActions = [
    {
      key: 'new',
      title: '开始新问诊',
      desc: '创建新的患者问诊会话',
      icon: <PlusOutlined style={{ fontSize: 24, color: '#fff' }} />,
      bg: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
      onClick: () => navigate('/interview/new')
    },
    {
      key: 'records',
      title: '病历管理',
      desc: '查看和管理所有病历',
      icon: <FileTextOutlined style={{ fontSize: 24, color: '#fff' }} />,
      bg: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
      onClick: () => navigate('/sessions')
    },
    {
      key: 'knowledge',
      title: '医学知识库',
      desc: '查阅症状与疾病知识',
      icon: <BookOutlined style={{ fontSize: 24, color: '#fff' }} />,
      bg: 'linear-gradient(135deg, #fa8c16 0%, #ffd666 100%)',
      onClick: () => navigate('/knowledge')
    },
    {
      key: 'stats',
      title: '数据分析',
      desc: '查看问诊数据统计',
      icon: <BarChartOutlined style={{ fontSize: 24, color: '#fff' }} />,
      bg: 'linear-gradient(135deg, #eb2f96 0%, #ffadd2 100%)',
      onClick: () => navigate('/dashboard')
    }
  ];

  return (
    <div className="home-page fade-in">
      {/* Hero Banner */}
      <div className="home-banner">
        <Row align="middle" justify="space-between" style={{ height: '100%', position: 'relative', zIndex: 2 }}>
          <Col xs={24} md={14} lg={16}>
            <div className="banner-content">
              <Title level={1} className="banner-title">
                医学生智能问诊辅助系统 <span style={{ opacity: 0.8, fontWeight: 300 }}>MSIA</span>
              </Title>
              <Paragraph className="banner-subtitle">
                结合 AI 技术的临床思维训练平台，提供标准化的问诊流程引导、实时诊断建议与循证医学知识支持。
              </Paragraph>
              
              <div className="banner-search">
                <Input.Search
                  placeholder="搜索病历、症状或知识库词条..."
                  enterButton={<Button type="primary" icon={<SearchOutlined />}>智能搜索</Button>}
                  size="large"
                  onSearch={(val) => console.log('Search:', val)}
                />
              </div>
            </div>
          </Col>
          <Col xs={0} md={10} lg={8} style={{ display: 'flex', justifyContent: 'center' }}>
             <div className="banner-illustration">
                <Lottie animationData={medicalPulseAnimation} loop={true} style={{ width: '100%', maxWidth: 320 }} />
             </div>
          </Col>
        </Row>
      </div>

      <div className="home-content">
        <Row gutter={[24, 24]}>
          {/* Left Column: Quick Actions & Recent Sessions */}
          <Col xs={24} lg={16}>
            {/* Quick Actions */}
            <section className="section-block">
              <Title level={4} className="section-header">
                <MedicineBoxOutlined /> 常用功能
              </Title>
              <Row gutter={[16, 16]}>
                {quickActions.map(action => (
                  <Col xs={24} sm={12} key={action.key}>
                    <div className="action-card" onClick={action.onClick}>
                      <div className="action-icon" style={{ background: action.bg }}>
                        {action.icon}
                      </div>
                      <div className="action-info">
                        <Text strong className="action-title">{action.title}</Text>
                        <Text type="secondary" className="action-desc">{action.desc}</Text>
                      </div>
                      <RightOutlined className="action-arrow" />
                    </div>
                  </Col>
                ))}
              </Row>
            </section>

            {/* Recent Sessions */}
            <section className="section-block" style={{ marginTop: 32 }}>
              <div className="section-header-wrapper">
                <Title level={4} className="section-header">
                  <ClockCircleOutlined /> 最近问诊
                </Title>
                <Button type="link" onClick={() => navigate('/sessions')}>查看全部</Button>
              </div>
              
              <Card variant="borderless" className="recent-card shadow-sm">
                {loading ? (
                  <Skeleton active />
                ) : stats.recentSessions.length === 0 ? (
                  <Text type="secondary">暂无问诊记录</Text>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {stats.recentSessions.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <Text strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.patient?.name || '未知患者'}
                              </Text>
                              {getStatusTag(item.status)}
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {item.patient?.gender} {item.patient?.age ? `${item.patient.age}岁` : ''}
                              </Text>
                            </div>
                            <Text
                              type="secondary"
                              style={{ maxWidth: 400 }}
                              ellipsis
                            >
                              {item.summary || '暂无摘要'}
                            </Text>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(item.createdAt).fromNow()}
                          </Text>
                          <Button type="link" size="small" onClick={() => navigate(`/interview/${item.id}`)}>
                            继续
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>
          </Col>

          {/* Right Column: Stats & Knowledge */}
          <Col xs={24} lg={8}>
            {/* Daily Stats */}
            <section className="section-block">
              <Title level={4} className="section-header">
                <BarChartOutlined /> 今日概览
              </Title>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card variant="borderless" className="stat-card mini shadow-sm">
                    <Statistic
                      title="今日问诊"
                      value={stats.todayCount}
                      suffix="人"
                      styles={{ content: { color: '#1890ff' } }}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card variant="borderless" className="stat-card mini shadow-sm">
                    <Statistic
                      title="累计完成"
                      value={stats.completedCount}
                      suffix="份"
                      styles={{ content: { color: '#52c41a' } }}
                    />
                  </Card>
                </Col>
              </Row>
            </section>

            {/* Daily Tip */}
            <section className="section-block" style={{ marginTop: 24 }}>
               <Card
                 variant="borderless"
                 className="tip-card shadow-sm"
                 style={{ background: 'linear-gradient(135deg, #fff 0%, #f0f5ff 100%)' }}
               >
                 <div style={{ display: 'flex', gap: 12 }}>
                   <div style={{ color: '#faad14', fontSize: 24 }}><BulbOutlined /></div>
                   <div>
                     <Text strong style={{ fontSize: 16 }}>每日医学贴士</Text>
                     <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                       问诊时注意观察患者的非语言行为，面部表情和肢体语言往往能提供重要的诊断线索。在询问既往史时，不要忘记询问过敏史和用药史。
                     </Paragraph>
                   </div>
                 </div>
               </Card>
            </section>

            {/* Knowledge Updates */}
            <section className="section-block" style={{ marginTop: 32 }}>
              <div className="section-header-wrapper">
                <Title level={4} className="section-header">
                  <BookOutlined /> 知识库更新
                </Title>
                <Button type="link" size="small" onClick={() => navigate('/knowledge')}>更多</Button>
              </div>
              <Card variant="borderless" className="knowledge-list-card shadow-sm">
                {loading ? (
                  <Skeleton active />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {stats.recentKnowledge.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/knowledge?key=${item.symptomKey}`)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', width: '100%', padding: '8px 0' }}
                      >
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1890ff', marginRight: 8 }}></div>
                        <Text style={{ flex: 1 }} ellipsis>
                          {item.displayName}
                        </Text>
                        <Tag style={{ marginRight: 0 }}>{item.category || '症状'}</Tag>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default Home;
