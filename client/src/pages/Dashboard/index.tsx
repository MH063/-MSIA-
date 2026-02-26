import React, { useEffect, useState } from 'react';
import { Typography, Row, Col, DatePicker, Button, Drawer, Space, Alert, Spin, Empty } from 'antd';
import { SyncOutlined, DownloadOutlined, BulbOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as echarts from 'echarts';
import EChartsWrapper from '../../components/EChartsWrapper';
import api, { type ApiResponse, unwrapData } from '../../utils/api';
import logger from '../../utils/logger';
import './index.css';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface DashboardStats {
  todayCount: number;
  completedCount: number;
  archivedCount: number;
  totalSessions: number;
  totalPatients: number;
  statusCounts: Record<string, number>;
  last7DaysSessions: Array<{ date: string; count: number }>;
  last7DaysCompleted: Array<{ date: string; count: number }>;
  recentSessions: Array<{ id: number; createdAt: string; status: string }>;
  knowledgeCount: number;
  recentKnowledge: Array<{ id: number; title: string; createdAt: string }>;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [selectedChartInfo, setSelectedChartInfo] = useState<{ title: string; content: string } | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);

  // 获取统计数据
  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sessions/stats') as ApiResponse<DashboardStats>;
      const data = unwrapData<DashboardStats>(res);
      if (data) {
        setStats(data);
      }
    } catch (error) {
      logger.error('[Dashboard] 获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // 计算统计数据
  const trendData = React.useMemo(() => {
    if (!stats?.last7DaysSessions) {
      return { dates: [], values: [] };
    }
    return {
      dates: stats.last7DaysSessions.map(item => dayjs(item.date).format('MM-DD')),
      values: stats.last7DaysSessions.map(item => item.count)
    };
  }, [stats]);

  const completionRate = React.useMemo(() => {
    if (!stats?.totalSessions || stats.totalSessions === 0) return 0;
    return Math.round((stats.completedCount / stats.totalSessions) * 100);
  }, [stats]);

  // 图表配置
  const lineOption: echarts.EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: trendData.dates },
    yAxis: { type: 'value' },
    series: [{
      name: '问诊量',
      type: 'line',
      smooth: true,
      data: trendData.values,
      areaStyle: { opacity: 0.3 },
      itemStyle: { color: '#0066CC' }
    }]
  };

  const statusOption: echarts.EChartsOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: '0%' },
    series: [{
      name: '会话状态',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      data: stats?.statusCounts 
        ? Object.entries(stats.statusCounts).map(([name, value]) => ({
            name: name === 'completed' ? '已完成' : name === 'archived' ? '已归档' : name === 'draft' ? '草稿' : name,
            value
          }))
        : []
    }]
  };

  const statsCards = [
    { title: '今日问诊', value: stats?.todayCount ?? 0, color: '#0066CC' },
    { title: '总问诊数', value: stats?.totalSessions ?? 0, color: '#00A3BF' },
    { title: '患者总数', value: stats?.totalPatients ?? 0, color: '#8B5CF6' },
    { title: '完成率', value: `${completionRate}%`, color: '#10B981' },
  ];

  const handleChartClick = (info: { title: string; content: string }) => {
    setSelectedChartInfo(info);
    setAiDrawerOpen(true);
  };

  const handleExport = () => {
    if (!stats) return;
    
    const exportData = {
      统计日期: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      今日问诊: stats.todayCount,
      总问诊数: stats.totalSessions,
      患者总数: stats.totalPatients,
      已完成: stats.completedCount,
      已归档: stats.archivedCount,
      完成率: `${completionRate}%`,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `数据统计_${dayjs().format('YYYYMMDD')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !stats) {
    return (
      <div className="dashboard-page msia-page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: 'var(--msia-text-secondary)' }}>加载统计数据...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page msia-page">
      <div className="dashboard-header">
        <Title level={2} style={{ margin: 0 }}>数据统计中心</Title>
        <Space>
          <RangePicker 
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
          />
          <Button 
            icon={<SyncOutlined spin={loading} />} 
            onClick={fetchStats}
            loading={loading}
          >
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!stats}>
            导出报表
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statsCards.map((card, index) => (
          <Col xs={12} sm={12} md={6} key={index}>
            <div className="stat-card" style={{ 
              background: '#fff', 
              padding: 20, 
              borderRadius: 8,
              borderLeft: `4px solid ${card.color}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <div style={{ fontSize: 14, color: 'var(--msia-text-secondary)', marginBottom: 8 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>
                {card.value}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* AI Insight Card - 仅在有数据时显示 */}
      {stats && stats.totalSessions > 0 && (
        <div 
          className="analysis-card" 
          onClick={() => handleChartClick({ 
            title: 'AI 智能分析报告', 
            content: `根据最近 7 天的数据分析，您的问诊量趋势如下：
            
- 总问诊数：${stats.totalSessions} 次
- 已完成：${stats.completedCount} 次 (${completionRate}%)
- 今日新增：${stats.todayCount} 次
- 患者总数：${stats.totalPatients} 人

建议关注数据变化趋势，优化问诊流程。` 
          })}
        >
          <Space align="start">
            <BulbOutlined style={{ fontSize: 24, color: '#0066CC' }} />
            <div>
              <Text strong style={{ fontSize: 16 }}>数据概览</Text>
              <Paragraph style={{ margin: 0, color: 'var(--msia-text-secondary)' }} ellipsis={{ rows: 2 }}>
                过去7天共有 {stats.last7DaysSessions.reduce((sum, item) => sum + item.count, 0)} 次问诊，
                平均每日 {(stats.last7DaysSessions.reduce((sum, item) => sum + item.count, 0) / 7).toFixed(1)} 次
              </Paragraph>
            </div>
          </Space>
        </div>
      )}

      {!stats || stats.totalSessions === 0 ? (
        <Empty 
          description="暂无统计数据" 
          style={{ marginTop: 60 }}
        />
      ) : (
        <Row gutter={[24, 24]}>
          {/* Line Chart */}
          <Col xs={24} lg={16}>
            <div className="chart-card">
              <div className="chart-title">
                问诊量趋势（近7天）
                <Button type="text" size="small" icon={<InfoCircleOutlined />} onClick={() => handleChartClick({ title: '问诊量趋势分析', content: '显示最近7天的问诊量变化趋势。' })} />
              </div>
              <EChartsWrapper option={lineOption} />
            </div>
          </Col>

          {/* Pie Chart */}
          <Col xs={24} lg={8}>
            <div className="chart-card">
              <div className="chart-title">
                会话状态分布
                <Button type="text" size="small" icon={<InfoCircleOutlined />} />
              </div>
              <EChartsWrapper option={statusOption} />
            </div>
          </Col>
        </Row>
      )}

      <Drawer
        title={
          <Space>
            <BulbOutlined style={{ color: '#0052D9' }} />
            {selectedChartInfo?.title || '数据分析'}
          </Space>
        }
        placement="right"
        onClose={() => setAiDrawerOpen(false)}
        open={aiDrawerOpen}
        size="default"
      >
        <Alert
          title="数据说明"
          description="以下数据基于实际问诊记录统计生成。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Title level={5}>详细解读</Title>
        <Paragraph>
          {selectedChartInfo?.content || '暂无详细分析内容。'}
        </Paragraph>
        
        {stats && (
          <>
            <Title level={5}>当前统计</Title>
            <ul>
              <li>总问诊数：{stats.totalSessions} 次</li>
              <li>已完成：{stats.completedCount} 次</li>
              <li>已归档：{stats.archivedCount} 次</li>
              <li>患者总数：{stats.totalPatients} 人</li>
              <li>知识库条目：{stats.knowledgeCount} 条</li>
            </ul>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default Dashboard;
