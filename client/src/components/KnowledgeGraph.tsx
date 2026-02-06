import React, { useMemo } from 'react';
import * as echarts from 'echarts';
import EChartsWrapper from './EChartsWrapper';
import { useThemeStore } from '../store/theme.store';

interface KnowledgeGraphProps {
  data: {
    nodes: { id: string; name: string; category: number; symbolSize?: number }[];
    links: { source: string; target: string; value?: string }[];
    categories: { name: string }[];
  };
  height?: number | string;
  onNodeClick?: (node: { id: string; name: string; category: number; symbolSize?: number }) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data, height = 500, onNodeClick }) => {
  const { mode } = useThemeStore();
  const isDark = mode === 'dark';
  type GraphNode = { id: string; name: string; category: number; symbolSize?: number };

  const option: echarts.EChartsOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}'
    },
    legend: {
      data: data.categories.map(a => a.name),
      textStyle: {
        color: isDark ? '#e0e0e0' : '#333'
      },
      bottom: 0
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: data.nodes.map(node => ({
          ...node,
          label: {
            show: node.symbolSize ? node.symbolSize > 20 : true,
            color: isDark ? '#fff' : '#333'
          }
        })),
        links: data.links as unknown as echarts.GraphSeriesOption['links'],
        categories: data.categories,
        roam: true,
        label: {
          position: 'right',
          formatter: '{b}'
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 10
          }
        },
        force: {
          repulsion: 100,
          edgeLength: [50, 200]
        }
      }
    ]
  }), [data, isDark]);

  const onEvents = useMemo(() => ({
    click: (params: unknown) => {
      const p = params as { dataType?: string; data?: unknown };
      if (p.dataType !== 'node' || !onNodeClick || !p.data || typeof p.data !== 'object') return;
      onNodeClick(p.data as GraphNode);
    }
  }), [onNodeClick]);

  return (
    <EChartsWrapper
      option={option}
      style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }}
      onEvents={onEvents}
    />
  );
};

export default KnowledgeGraph;
