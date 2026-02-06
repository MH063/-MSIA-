import React from 'react';
import EChartsWrapper from '../../../components/EChartsWrapper';

interface KnowledgeGraphProps {
  data: {
    nodes: { id: string; name: string; category: number; symbolSize?: number }[];
    links: { source: string; target: string; value?: string }[];
    categories: { name: string }[];
  };
  onClick?: (params: { dataType?: string; data?: { id: string; name: string; category: number; symbolSize?: number } }) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data, onClick }) => {
  const option = {
    tooltip: {},
    legend: [{
      data: data.categories.map(function (a) {
        return a.name;
      })
    }],
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: data.nodes,
        links: data.links,
        categories: data.categories,
        roam: true,
        label: {
          show: true,
          position: 'right',
          formatter: '{b}'
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
          repulsion: 100
        }
      }
    ]
  };

  return (
    <EChartsWrapper 
      option={option} 
      style={{ height: '500px', width: '100%' }} 
      onEvents={onClick ? { click: onClick } : undefined}
    />
  );
};

export default KnowledgeGraph;
