import React from 'react';
import { Grid } from 'antd';
import * as echarts from 'echarts';
import EChartsWrapper from '../../../components/EChartsWrapper';

const { useBreakpoint } = Grid;

interface KnowledgeGraphProps {
  data: {
    nodes: { id: string; name: string; category: number; symbolSize?: number }[];
    links: { source: string; target: string; value?: string | number }[];
    categories: { name: string }[];
  };
  onClick?: (params: { dataType?: string; data?: { id: string; name: string; category: number; symbolSize?: number } }) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data, onClick }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const option: echarts.EChartsOption = {
    tooltip: {},
    legend: [{
      data: data.categories.map(a => a.name),
      orient: isMobile ? 'horizontal' : 'vertical' as const,
      left: isMobile ? 'center' : 'left' as const,
      top: isMobile ? 'top' : 'bottom' as const,
    }],
    series: [{
      type: 'graph',
      layout: 'force' as const,
      data: data.nodes.map(node => ({
        ...node,
        symbolSize: isMobile ? (node.symbolSize ? node.symbolSize * 0.8 : 30) : node.symbolSize
      })),
      links: data.links.map(link => ({
        source: link.source,
        target: link.target,
        value: link.value ? Number(link.value) : undefined
      })),
      categories: data.categories,
      roam: true,
      draggable: true,
      label: {
        show: true,
        position: 'right' as const,
        formatter: '{b}',
        fontSize: isMobile ? 10 : 12
      },
      labelLayout: {
        hideOverlap: true
      },
      scaleLimit: {
        min: 0.4,
        max: 2
      },
      lineStyle: {
        color: 'source',
        curveness: 0.3
      },
      force: {
        repulsion: isMobile ? 60 : 100,
        edgeLength: isMobile ? [30, 80] : [50, 100]
      }
    }]
  };

  return (
    <EChartsWrapper 
      option={option} 
      style={{ height: '100%', width: '100%', minHeight: '300px' }} 
      onEvents={onClick ? { click: (params: unknown) => onClick(params as { dataType?: string; data?: { id: string; name: string; category: number; symbolSize?: number } }) } : undefined}
    />
  );
};

export default KnowledgeGraph;
