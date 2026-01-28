import React, { useEffect, useState } from 'react';
import { Button, Typography, Card, Row, Col, Statistic, Avatar, Space, Badge } from 'antd';
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

const { Title, Text, Paragraph } = Typography;

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
        const res: ApiResponse<Stats | { data: Stats }> = await api.get('/sessions/stats');
        if (res?.success) {
            const payload = unwrapData<Stats>(res);
            if (payload) setStats(payload);
        }
    } catch (err) {
        console.error(err);
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

  return (
    <div style={{ padding: '0 12px' }}>
      {/* 顶部欢迎 Banner */}
      <Card 
        style={{ 
          marginBottom: 24, 
          background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
          color: 'white'
        }}
        variant="borderless"
        styles={{ body: { padding: '32px' } }}
      >
        <Row align="middle" gutter={24}>
          <Col flex="1">
            <Title level={2} style={{ color: 'white', margin: 0 }}>
              欢迎使用医学生智能问诊辅助系统 (MSIA)
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.85)', marginTop: 12, fontSize: 16 }}>
              今天是 {dayjs().format('YYYY年MM月DD日')}，系统运行正常。准备好开始今天的问诊练习了吗？
            </Paragraph>
          </Col>
          <Col>
            <Space size="large">
              <Statistic 
                title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>今日已问诊</span>} 
                value={stats.todayCount} 
                loading={loading}
                styles={{ content: { color: 'white' } }}
              />
              <Statistic 
                title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>系统状态</span>} 
                value="在线" 
                styles={{ content: { color: '#52c41a' } }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 24]}>
        {/* 左侧：核心功能区 */}
        <Col xs={24} lg={16}>
          <Card 
            title={<Space><MedicineBoxOutlined /><span>工作台</span></Space>}
            variant="borderless"
            style={{ height: '100%' }}
          >
            <Row gutter={[24, 24]}>
              <Col span={24}>
                <Card 
                  hoverable 
                  style={{ 
                    background: '#f0f5ff', 
                    borderColor: '#adc6ff',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate('/interview/new')}
                >
                  <Row align="middle">
                    <Col flex="1">
                      <Title level={4} style={{ color: '#1d39c4' }}>开始新问诊</Title>
                      <Text type="secondary">创建新的标准问诊会话，录入患者信息并开始模拟问诊流程。</Text>
                    </Col>
                    <Col>
                      <Button type="primary" shape="circle" icon={<ArrowRightOutlined />} size="large" />
                    </Col>
                  </Row>
                </Card>
              </Col>
              
              <Col span={12}>
                <Card hoverable title="我的病历" extra={<a onClick={() => navigate('/interview')} style={{ cursor: 'pointer' }}>查看全部</a>}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <Text type="secondary">已归档</Text>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{stats.archivedCount}</div>
                    </div>
                    <div>
                      <Text type="secondary">已完成</Text>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{stats.completedCount}</div>
                    </div>
                  </div>
                  {stats.recentSessions && stats.recentSessions.length > 0 ? (
                      <div>
                          {stats.recentSessions.slice(0, 3).map((item: Session, idx: number) => (
                              <div key={item.id} 
                                   style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: idx !== Math.min(2, stats.recentSessions.length - 1) ? '1px solid #f0f0f0' : 'none', cursor: 'pointer' }}
                                   onClick={() => navigate(`/interview/${item.id}`)}>
                                  <div style={{ marginRight: 12, fontSize: 18 }}>{getStatusIcon(item.status)}</div>
                                  <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 500 }}>
                                          {item.patient?.name || '未知患者'}
                                          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{getStatusText(item.status)}</Text>
                                      </div>
                                      <div style={{ color: 'rgba(0, 0, 0, 0.45)' }}>{dayjs(item.createdAt).fromNow()}</div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: '#ccc' }}>
                          <FileTextOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                          <p>暂无病历记录</p>
                      </div>
                  )}
                </Card>
              </Col>
              
              <Col span={12}>
                <Card hoverable title="知识库" extra={<Button type="link" onClick={() => navigate('/knowledge')} style={{ padding: 0 }}>浏览</Button>}>
                  {stats.knowledgeCount > 0 ? (
                    <div style={{ padding: '0' }}>
                      <div style={{ textAlign: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.knowledgeCount}</div>
                        <div style={{ color: '#8c8c8c' }}>知识库条目</div>
                      </div>
                      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                        {stats.recentKnowledge.map((k: Knowledge) => (
                           <div key={k.id} style={{ fontSize: 13, color: '#595959', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                             • {k.displayName}
                           </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#ccc' }}>
                      <ScheduleOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                      <p>知识库暂无内容</p>
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
              variant="borderless"
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <Avatar size="large" icon={<UserOutlined />} style={{ backgroundColor: '#87d068', marginRight: 16 }} />
                <div>
                  <Text strong>当前用户</Text>
                  <br />
                  <Text type="secondary">医学生 (实习)</Text>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #f0f0f0' }}>
                <Text>科室</Text>
                <Text strong>全科医学</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #f0f0f0' }}>
                <Text>状态</Text>
                <Badge status="processing" text="工作中" />
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default Home;
