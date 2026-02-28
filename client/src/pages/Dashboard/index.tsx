import React, { useEffect, useState } from 'react';
import { Typography, DatePicker, Button, Drawer, Space, Alert, Spin, Tooltip } from 'antd';
import { 
  SyncOutlined, 
  DownloadOutlined, 
  BulbOutlined, 
  InfoCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  FallOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as echarts from 'echarts';
import EChartsWrapper from '../../components/EChartsWrapper';
import api, { type ApiResponse, unwrapData } from '../../utils/api';
import logger from '../../utils/logger';
import './index.css';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

/**
 * 仪表盘统计数据接口
 */
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

/**
 * 统计卡片配置接口
 */
interface StatCardConfig {
  key: string;
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
  iconClass: string;
  trend?: { value: number; isUp: boolean };
}

/**
 * 仪表盘页面组件
 * 展示问诊统计数据、趋势图表和数据分析
 */
const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [selectedChartInfo, setSelectedChartInfo] = useState<{ title: string; content: string } | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);

  /**
   * 获取统计数据
   */
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

  /**
   * 计算趋势数据
   */
  const trendData = React.useMemo(() => {
    if (!stats?.last7DaysSessions) {
      return { dates: [], values: [] };
    }
    return {
      dates: stats.last7DaysSessions.map(item => dayjs(item.date).format('MM-DD')),
      values: stats.last7DaysSessions.map(item => item.count)
    };
  }, [stats]);

  /**
   * 计算完成率
   */
  const completionRate = React.useMemo(() => {
    if (!stats?.totalSessions || stats.totalSessions === 0) return 0;
    return Math.round((stats.completedCount / stats.totalSessions) * 100);
  }, [stats]);

  /**
   * 计算日均问诊量
   */
  const dailyAverage = React.useMemo(() => {
    if (!stats?.last7DaysSessions) return 0;
    const total = stats.last7DaysSessions.reduce((sum, item) => sum + item.count, 0);
    return (total / 7).toFixed(1);
  }, [stats]);

  /**
   * 折线图配置
   */
  const lineOption: echarts.EChartsOption = {
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'var(--msia-border)',
      borderWidth: 1,
      textStyle: { color: 'var(--msia-text-primary)' },
      formatter: (params: unknown) => {
        const data = params as Array<{ axisValue: string; value: number; marker: string }>;
        if (!data || !data[0]) return '';
        return `
          <div style="padding: 8px 12px;">
            <div style="font-weight: 600; margin-bottom: 6px; color: var(--msia-text-primary);">${data[0].axisValue}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${data[0].marker}
              <span style="color: var(--msia-text-secondary);">问诊量：</span>
              <span style="font-weight: 600; color: var(--msia-primary);">${data[0].value}</span>
            </div>
          </div>
        `;
      }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '8%', containLabel: true },
    xAxis: { 
      type: 'category', 
      boundaryGap: false, 
      data: trendData.dates,
      axisLine: { lineStyle: { color: 'var(--msia-border)' } },
      axisLabel: { color: 'var(--msia-text-secondary)' }
    },
    yAxis: { 
      type: 'value',
      splitLine: { lineStyle: { color: 'var(--msia-border-light)', type: 'dashed' } },
      axisLabel: { color: 'var(--msia-text-secondary)' }
    },
    series: [{
      name: '问诊量',
      type: 'line',
      smooth: true,
      data: trendData.values,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { 
        width: 3,
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#0066CC' },
          { offset: 1, color: '#00A3BF' }
        ])
      },
      areaStyle: { 
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(0, 102, 204, 0.25)' },
          { offset: 1, color: 'rgba(0, 102, 204, 0.02)' }
        ])
      },
      itemStyle: { 
        color: '#0066CC',
        borderWidth: 2,
        borderColor: '#fff'
      }
    }]
  };

  /**
   * 饼图配置
   */
  const statusOption: echarts.EChartsOption = {
    tooltip: { 
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'var(--msia-border)',
      borderWidth: 1,
      textStyle: { color: 'var(--msia-text-primary)' }
    },
    legend: { 
      bottom: '4%',
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
      textStyle: { color: 'var(--msia-text-secondary)' }
    },
    series: [{
      name: '会话状态',
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: false,
      itemStyle: { 
        borderRadius: 10, 
        borderColor: 'var(--msia-card)', 
        borderWidth: 3 
      },
      label: { show: false },
      emphasis: {
        label: { 
          show: true, 
          fontSize: 14, 
          fontWeight: 'bold',
          color: 'var(--msia-text-primary)'
        },
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.2)'
        }
      },
      data: stats?.statusCounts 
        ? Object.entries(stats.statusCounts).map(([name, value]) => ({
            name: name === 'completed' ? '已完成' : name === 'archived' ? '已归档' : name === 'draft' ? '草稿' : name,
            value,
            itemStyle: {
              color: name === 'completed' ? '#10B981' : name === 'archived' ? '#8B5CF6' : name === 'draft' ? '#F59E0B' : '#6B7280'
            }
          }))
        : []
    }]
  };

  /**
   * 统计卡片配置
   */
  const statsCards: StatCardConfig[] = [
    { 
      key: 'today',
      title: '今日问诊', 
      value: stats?.todayCount ?? 0, 
      icon: <CalendarOutlined />,
      colorClass: 'stat-card-blue',
      iconClass: 'stat-icon-blue'
    },
    { 
      key: 'total',
      title: '总问诊数', 
      value: stats?.totalSessions ?? 0, 
      icon: <FileTextOutlined />,
      colorClass: 'stat-card-cyan',
      iconClass: 'stat-icon-cyan'
    },
    { 
      key: 'patients',
      title: '患者总数', 
      value: stats?.totalPatients ?? 0, 
      icon: <TeamOutlined />,
      colorClass: 'stat-card-purple',
      iconClass: 'stat-icon-purple'
    },
    { 
      key: 'rate',
      title: '完成率', 
      value: `${completionRate}%`, 
      icon: <CheckCircleOutlined />,
      colorClass: 'stat-card-green',
      iconClass: 'stat-icon-green'
    },
  ];

  /**
   * 处理图表点击事件
   */
  const handleChartClick = (info: { title: string; content: string }) => {
    setSelectedChartInfo(info);
    setAiDrawerOpen(true);
  };

  /**
   * 导出报表
   */
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
      日均问诊: dailyAverage,
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
      <div className="dashboard-page msia-page">
        <div className="dashboard-loading">
          <Spin size="large" />
          <div className="dashboard-loading-text">加载统计数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page msia-page">
      {/* 页面头部 */}
      <div className="dashboard-header">
        <div>
          <Title level={2}>数据统计中心</Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 14 }}>
            实时监控问诊数据，洞察业务趋势
          </Text>
        </div>
        <Space size={12} wrap>
          <RangePicker 
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
          />
          <Tooltip title="刷新数据">
            <Button 
              icon={<SyncOutlined spin={loading} />} 
              onClick={fetchStats}
              loading={loading}
            >
              刷新
            </Button>
          </Tooltip>
          <Tooltip title="导出JSON报表">
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!stats}>
              导出报表
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid">
        {statsCards.map((card) => (
          <div key={card.key} className={`stat-card ${card.colorClass}`}>
            <div className={`stat-card-icon ${card.iconClass}`}>
              {card.icon}
            </div>
            <div className="stat-card-label">{card.title}</div>
            <div className="stat-card-value">{card.value}</div>
            {card.trend && (
              <div className={`stat-card-trend ${card.trend.isUp ? 'trend-up' : 'trend-down'}`}>
                {card.trend.isUp ? <RiseOutlined /> : <FallOutlined />}
                <span>{Math.abs(card.trend.value)}%</span>
                <span style={{ color: 'var(--msia-text-tertiary)' }}>较昨日</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* AI Insight Card */}
      {stats && stats.totalSessions > 0 && (
        <div 
          className="analysis-card" 
          onClick={() => handleChartClick({ 
            title: 'AI 智能分析报告', 
            content: `根据最近 7 天的数据分析，您的问诊量趋势如下：

• 总问诊数：${stats.totalSessions} 次
• 已完成：${stats.completedCount} 次 (${completionRate}%)
• 今日新增：${stats.todayCount} 次
• 患者总数：${stats.totalPatients} 人
• 日均问诊：${dailyAverage} 次

建议关注数据变化趋势，优化问诊流程。` 
          })}
        >
          <Space align="start" size={16}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 14, 
              background: 'var(--msia-primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BulbOutlined style={{ fontSize: 22, color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <Text strong style={{ fontSize: 16, color: 'var(--msia-text-primary)' }}>
                数据概览
              </Text>
              <Paragraph style={{ margin: '6px 0 0 0', color: 'var(--msia-text-secondary)' }} ellipsis={{ rows: 2 }}>
                过去7天共有 <strong style={{ color: 'var(--msia-primary)' }}>{stats.last7DaysSessions.reduce((sum, item) => sum + item.count, 0)}</strong> 次问诊，
                平均每日 <strong style={{ color: 'var(--msia-primary)' }}>{dailyAverage}</strong> 次，
                点击查看详细分析报告
              </Paragraph>
            </div>
          </Space>
        </div>
      )}

      {/* 空状态或图表 */}
      {!stats || stats.totalSessions === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty-icon">
            <FileTextOutlined />
          </div>
          <div className="dashboard-empty-text">暂无统计数据</div>
          <div className="dashboard-empty-hint">开始问诊后将在此展示数据统计</div>
        </div>
      ) : (
        <div className="charts-grid">
          {/* 折线图 */}
          <div className="chart-card">
            <div className="chart-title">
              <span>问诊量趋势（近7天）</span>
              <Tooltip title="显示最近7天的问诊量变化趋势">
                <Button type="text" size="small" icon={<InfoCircleOutlined />} />
              </Tooltip>
            </div>
            <div className="chart-content">
              <EChartsWrapper option={lineOption} />
            </div>
          </div>

          {/* 饼图 */}
          <div className="chart-card">
            <div className="chart-title">
              <span>会话状态分布</span>
              <Tooltip title="各状态会话的占比分布">
                <Button type="text" size="small" icon={<InfoCircleOutlined />} />
              </Tooltip>
            </div>
            <div className="chart-content">
              <EChartsWrapper option={statusOption} />
            </div>
          </div>
        </div>
      )}

      {/* 详情抽屉 */}
      <Drawer
        title={
          <Space>
            <BulbOutlined style={{ color: 'var(--msia-primary)' }} />
            <span>{selectedChartInfo?.title || '数据分析'}</span>
          </Space>
        }
        placement="right"
        onClose={() => setAiDrawerOpen(false)}
        open={aiDrawerOpen}
        size="large"
        className="dashboard-drawer"
      >
        <Alert
          title="数据说明"
          description="以下数据基于实际问诊记录统计生成。"
          type="info"
          showIcon
          style={{ marginBottom: 24, borderRadius: 10 }}
        />
        
        <div className="drawer-section">
          <div className="drawer-section-title">详细解读</div>
          <Paragraph style={{ whiteSpace: 'pre-line', color: 'var(--msia-text-secondary)' }}>
            {selectedChartInfo?.content || '暂无详细分析内容。'}
          </Paragraph>
        </div>
        
        {stats && (
          <div className="drawer-section">
            <div className="drawer-section-title">当前统计</div>
            <ul className="drawer-stats-list">
              <li>
                <span className="label">总问诊数</span>
                <span className="value">{stats.totalSessions} 次</span>
              </li>
              <li>
                <span className="label">已完成</span>
                <span className="value">{stats.completedCount} 次</span>
              </li>
              <li>
                <span className="label">已归档</span>
                <span className="value">{stats.archivedCount} 次</span>
              </li>
              <li>
                <span className="label">患者总数</span>
                <span className="value">{stats.totalPatients} 人</span>
              </li>
              <li>
                <span className="label">知识库条目</span>
                <span className="value">{stats.knowledgeCount} 条</span>
              </li>
              <li>
                <span className="label">日均问诊</span>
                <span className="value">{dailyAverage} 次</span>
              </li>
            </ul>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Dashboard;
