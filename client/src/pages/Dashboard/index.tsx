import React, { useEffect, useState } from 'react';
import { Typography, Row, Col, DatePicker, Button, Drawer, Space, Alert } from 'antd';
import { SyncOutlined, DownloadOutlined, BulbOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import EChartsWrapper from '../../components/EChartsWrapper';
import './index.css';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const Dashboard: React.FC = () => {
  const [loading] = useState(false);
  const [trendData, setTrendData] = useState<{ dates: string[]; values: number[] }>(() => {
    const dates: string[] = [];
    const values: number[] = [];
    for (let i = 0; i < 30; i++) {
      dates.push(dayjs().subtract(29 - i, 'day').format('MM-DD'));
      values.push(Math.floor(Math.random() * 50) + 10);
    }
    return { dates, values };
  });
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [selectedChartInfo, setSelectedChartInfo] = useState<{ title: string; content: string } | null>(null);

  // Mock Data Generators
  const generateTrendData = () => {
    const dates = [];
    const values = [];
    for (let i = 0; i < 30; i++) {
      dates.push(dayjs().subtract(29 - i, 'day').format('MM-DD'));
      values.push(Math.floor(Math.random() * 50) + 10);
    }
    return { dates, values };
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTrendData(generateTrendData());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Chart Options
  const lineOption = {
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
      itemStyle: { color: '#0052D9' }
    }]
  };

  const barOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['0-18', '19-30', '31-45', '46-60', '60+'] },
    yAxis: { type: 'value' },
    series: [{
      name: '患者年龄',
      type: 'bar',
      data: [12, 34, 45, 23, 15],
      itemStyle: { borderRadius: [4, 4, 0, 0], color: '#36CFC9' }
    }]
  };

  const pieOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: '0%' },
    series: [{
      name: '诊断分布',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      data: [
        { value: 1048, name: '上呼吸道感染' },
        { value: 735, name: '急性胃肠炎' },
        { value: 580, name: '高血压' },
        { value: 484, name: '偏头痛' },
        { value: 300, name: '其他' }
      ]
    }]
  };

  const radarOption = {
    radar: {
      indicator: [
        { name: '问诊完整性', max: 100 },
        { name: '诊断准确率', max: 100 },
        { name: '沟通技巧', max: 100 },
        { name: '病历规范', max: 100 },
        { name: '鉴别诊断', max: 100 },
        { name: '治疗建议', max: 100 }
      ]
    },
    series: [{
      name: '能力模型',
      type: 'radar',
      data: [{
        value: [85, 90, 75, 95, 80, 88],
        name: '当前评估',
        areaStyle: { opacity: 0.2 }
      }]
    }]
  };

  const funnelOption = {
    tooltip: { trigger: 'item' },
    series: [{
      name: '诊疗流程转化',
      type: 'funnel',
      left: '10%',
      top: 60,
      bottom: 60,
      width: '80%',
      min: 0,
      max: 100,
      minSize: '0%',
      maxSize: '100%',
      sort: 'descending',
      gap: 2,
      label: { show: true, position: 'inside' },
      data: [
        { value: 60, name: '完成诊断' },
        { value: 40, name: '开具处方' },
        { value: 20, name: '随访' },
        { value: 80, name: '采集病史' },
        { value: 100, name: '接诊' }
      ]
    }]
  };

  const heatmapOption = {
    tooltip: { position: 'top' },
    grid: { height: '50%', top: '10%' },
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], splitArea: { show: true } },
    yAxis: { type: 'category', data: ['Morning', 'Afternoon', 'Evening'], splitArea: { show: true } },
    visualMap: { min: 0, max: 10, calculable: true, orient: 'horizontal', left: 'center', bottom: '15%' },
    series: [{
      name: '就诊热力图',
      type: 'heatmap',
      data: [
        [0, 0, 5], [0, 1, 1], [0, 2, 0],
        [1, 0, 3], [1, 1, 5], [1, 2, 2],
        [2, 0, 8], [2, 1, 9], [2, 2, 4],
        [3, 0, 7], [3, 1, 8], [3, 2, 3],
        [4, 0, 6], [4, 1, 7], [4, 2, 2],
        [5, 0, 2], [5, 1, 1], [5, 2, 1],
        [6, 0, 1], [6, 1, 0], [6, 2, 0]
      ],
      label: { show: true }
    }]
  };

  // Real-time refresh simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, 15000); // 15s refresh
    return () => clearInterval(timer);
  }, []);

  const handleChartClick = (info: { title: string; content: string }) => {
    setSelectedChartInfo(info);
    setAiDrawerOpen(true);
  };

  return (
    <div className="dashboard-page msia-page">
      <div className="dashboard-header">
        <Title level={2} style={{ margin: 0 }}>数据统计中心</Title>
        <Space>
          <RangePicker defaultValue={[dayjs().subtract(30, 'days'), dayjs()]} />
          <Button 
            icon={<SyncOutlined spin={loading} />} 
            onClick={() => setTrendData(generateTrendData())}
          >
            刷新
          </Button>
          <Button icon={<DownloadOutlined />}>导出报表</Button>
        </Space>
      </div>

      {/* AI Insight Card */}
      <div 
        className="analysis-card" 
        onClick={() => handleChartClick({ 
          title: 'AI 智能分析报告', 
          content: '根据最近 30 天的数据分析，您的诊断准确率提升了 5%，但问诊耗时略有增加。建议在"既往史"采集中使用更多的模板以提高效率。上呼吸道感染病例占比最高（35%），建议关注流感季节的防护建议更新。' 
        })}
      >
        <Space align="start">
          <BulbOutlined style={{ fontSize: 24, color: '#0052D9' }} />
          <div>
            <Text strong style={{ fontSize: 16 }}>AI 智能洞察</Text>
            <Paragraph style={{ margin: 0, color: 'var(--msia-text-secondary)' }} ellipsis={{ rows: 2 }}>
              本周问诊量呈上升趋势，主要集中在周三下午。诊断准确率保持在 90% 以上，建议加强对少见病的鉴别诊断训练...
            </Paragraph>
          </div>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {/* Line Chart */}
        <Col xs={24} lg={16}>
          <div className="chart-card">
            <div className="chart-title">
              问诊量趋势
              <Button type="text" size="small" icon={<InfoCircleOutlined />} onClick={() => handleChartClick({ title: '问诊量趋势分析', content: '问诊量波动较大，周末有明显下降。' })} />
            </div>
            <EChartsWrapper option={lineOption} />
          </div>
        </Col>

        {/* Pie Chart */}
        <Col xs={24} lg={8}>
          <div className="chart-card">
            <div className="chart-title">
              疾病分布
              <Button type="text" size="small" icon={<InfoCircleOutlined />} />
            </div>
            <EChartsWrapper option={pieOption} />
          </div>
        </Col>

        {/* Bar Chart */}
        <Col xs={24} lg={8}>
          <div className="chart-card">
            <div className="chart-title">患者年龄分布</div>
            <EChartsWrapper option={barOption} />
          </div>
        </Col>

        {/* Radar Chart */}
        <Col xs={24} lg={8}>
          <div className="chart-card">
            <div className="chart-title">临床能力模型</div>
            <EChartsWrapper option={radarOption} />
          </div>
        </Col>

        {/* Funnel Chart */}
        <Col xs={24} lg={8}>
          <div className="chart-card">
            <div className="chart-title">诊疗转化漏斗</div>
            <EChartsWrapper option={funnelOption} />
          </div>
        </Col>
        
        {/* Heatmap */}
        <Col xs={24}>
           <div className="chart-card">
            <div className="chart-title">就诊时段热力图</div>
            <EChartsWrapper option={heatmapOption} style={{ height: '350px', width: '100%' }} />
          </div>
        </Col>
      </Row>

      <Drawer
        title={
          <Space>
            <BulbOutlined style={{ color: '#0052D9' }} />
            {selectedChartInfo?.title || 'AI 分析'}
          </Space>
        }
        placement="right"
        onClose={() => setAiDrawerOpen(false)}
        open={aiDrawerOpen}
        size={400}
      >
        <Alert
          title="AI 诊断建议"
          description="基于大数据模型分析，该数据指标正常，但在效率方面仍有提升空间。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Title level={5}>详细解读</Title>
        <Paragraph>
          {selectedChartInfo?.content || '暂无详细分析内容。'}
        </Paragraph>
        
        <Title level={5}>改进建议</Title>
        <ul>
          <li>建议优化问诊节奏，控制单次问诊时长在 15 分钟以内。</li>
          <li>关注季节性流行病趋势，提前准备相关知识库。</li>
          <li>针对"鉴别诊断"环节进行专项强化训练。</li>
        </ul>
      </Drawer>
    </div>
  );
};

export default Dashboard;
