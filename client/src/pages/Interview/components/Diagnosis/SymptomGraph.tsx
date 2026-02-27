import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Tag, Tooltip, Button, Space, Typography, Progress, Empty, theme, Skeleton } from 'antd';
import { 
  BranchesOutlined, 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  FullscreenOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface SymptomNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'current' | 'associated' | 'differential' | 'redFlag';
  confidence?: number;
  description?: string;
  category?: string;
}

interface SymptomLink extends d3.SimulationLinkDatum<SymptomNode> {
  source: string | SymptomNode;
  target: string | SymptomNode;
  type: 'association' | 'exclusion' | 'support' | 'redFlag';
  strength: number;
  description?: string;
}

interface SymptomGraphProps {
  currentSymptom: string;
  associatedSymptoms: string[];
  differentialDiagnoses: Array<{
    name: string;
    confidence: number;
    supportingSymptoms: string[];
    excludingSymptoms: string[];
    redFlags: string[];
  }>;
  redFlags: string[];
  onNodeClick?: (node: SymptomNode) => void;
  onExcludeDiagnosis?: (diagnosis: string) => void;
  onPrioritizeDiagnosis?: (diagnosis: string) => void;
  loading?: boolean;
}

const SymptomGraph: React.FC<SymptomGraphProps> = ({
  currentSymptom,
  associatedSymptoms,
  differentialDiagnoses,
  redFlags,
  onNodeClick,
  onExcludeDiagnosis,
  onPrioritizeDiagnosis,
  loading = false
}) => {
  const { token } = theme.useToken();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const [excludedDiagnoses, setExcludedDiagnoses] = useState<Set<string>>(new Set());
  const [prioritizedDiagnosis, setPrioritizedDiagnosis] = useState<string | null>(null);

  const PRIORITY_CONFIG = useMemo(() => ({
    high: { color: token.colorError, bgColor: token.colorErrorBg, borderColor: token.colorErrorBorder, label: '高优先级', icon: <WarningOutlined /> },
    medium: { color: token.colorWarning, bgColor: token.colorWarningBg, borderColor: token.colorWarningBorder, label: '中优先级', icon: <InfoCircleOutlined /> },
    low: { color: token.colorTextSecondary, bgColor: token.colorFillQuaternary, borderColor: token.colorBorder, label: '低优先级', icon: <QuestionCircleOutlined /> }
  }), [token]);

  const buildGraphData = useCallback(() => {
    const nodes: SymptomNode[] = [];
    const links: SymptomLink[] = [];

    nodes.push({
      id: 'current',
      name: currentSymptom,
      type: 'current',
      category: '当前症状'
    });

    associatedSymptoms.forEach((symptom, index) => {
      const nodeId = `assoc_${index}`;
      nodes.push({
        id: nodeId,
        name: symptom,
        type: 'associated',
        category: '伴随症状'
      });
      links.push({
        source: 'current',
        target: nodeId,
        type: 'association',
        strength: 0.7,
        description: '伴随出现'
      });
    });

    redFlags.forEach((flag, index) => {
      const nodeId = `redflag_${index}`;
      nodes.push({
        id: nodeId,
        name: flag,
        type: 'redFlag',
        category: '警惕征象'
      });
      links.push({
        source: 'current',
        target: nodeId,
        type: 'redFlag',
        strength: 1,
        description: '警惕征象'
      });
    });

    differentialDiagnoses
      .filter(d => !excludedDiagnoses.has(d.name))
      .forEach((diagnosis, index) => {
        const nodeId = `diag_${index}`;
        nodes.push({
          id: nodeId,
          name: diagnosis.name,
          type: 'differential',
          confidence: diagnosis.confidence,
          category: '鉴别诊断',
          description: `置信度: ${(diagnosis.confidence * 100).toFixed(1)}%`
        });

        diagnosis.supportingSymptoms.forEach(symptom => {
          const assocNode = nodes.find(n => n.name === symptom && n.type === 'associated');
          if (assocNode) {
            links.push({
              source: assocNode.id,
              target: nodeId,
              type: 'support',
              strength: diagnosis.confidence * 0.8,
              description: '支持诊断'
            });
          }
        });

        diagnosis.excludingSymptoms.forEach(symptom => {
          const assocNode = nodes.find(n => n.name === symptom && n.type === 'associated');
          if (assocNode) {
            links.push({
              source: assocNode.id,
              target: nodeId,
              type: 'exclusion',
              strength: 0.5,
              description: '不支持诊断'
            });
          }
        });
      });

    return { nodes, links };
  }, [currentSymptom, associatedSymptoms, differentialDiagnoses, redFlags, excludedDiagnoses]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || loading) return;

    const { width, height } = containerRef.current.getBoundingClientRect();
    const { nodes, links } = buildGraphData();

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);

    const colorMap: Record<string, string> = {
      current: token.colorError,
      associated: token.colorPrimary,
      differential: '#722ed1', // Keep purple for distinction, or use token.colorInfo
      redFlag: token.colorWarning
    };

    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links).id((d: d3.SimulationNodeDatum) => (d as SymptomNode).id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d: SymptomLink) => {
        switch (d.type) {
          case 'support': return token.colorSuccess;
          case 'exclusion': return token.colorError;
          case 'redFlag': return token.colorWarning;
          default: return token.colorBorder;
        }
      })
      .attr('stroke-width', (d: SymptomLink) => Math.sqrt(d.strength * 5))
      .attr('stroke-dasharray', (d: SymptomLink) => d.type === 'exclusion' ? '5,5' : 'none')
      .attr('opacity', 0.7);

    const node = g.append('g')
      .selectAll<SVGGElement, SymptomNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SymptomNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x ?? d.fx;
          d.fy = d.y ?? d.fy;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    node.append('circle')
      .attr('r', (d: SymptomNode) => d.type === 'current' ? 25 : d.type === 'differential' ? 20 : 15)
      .attr('fill', (d: SymptomNode) => colorMap[d.type])
      .attr('stroke', token.colorBgContainer)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', (d: SymptomNode) => prioritizedDiagnosis === d.name ? 4 : 2);

    node.append('text')
      .text((d: SymptomNode) => d.name)
      .attr('x', 0)
      .attr('y', (d: SymptomNode) => d.type === 'current' ? 35 : 28)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', token.colorText)
      .style('pointer-events', 'none');

    node.filter((d: SymptomNode) => d.type === 'differential' && d.confidence !== undefined)
      .append('text')
      .text((d: SymptomNode) => `${(d.confidence! * 100).toFixed(0)}%`)
      .attr('x', 0)
      .attr('y', 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#fff') // Keep white text on colored circles
      .style('pointer-events', 'none');

    node.on('click', (event, d: SymptomNode) => {
      event.stopPropagation();
      onNodeClick?.(d);
    });

    simulation.on('tick', () => {
      link
        .attr('x1', (d: d3.SimulationLinkDatum<d3.SimulationNodeDatum>) => (d.source as SymptomNode).x ?? 0)
        .attr('y1', (d: d3.SimulationLinkDatum<d3.SimulationNodeDatum>) => (d.source as SymptomNode).y ?? 0)
        .attr('x2', (d: d3.SimulationLinkDatum<d3.SimulationNodeDatum>) => (d.target as SymptomNode).x ?? 0)
        .attr('y2', (d: d3.SimulationLinkDatum<d3.SimulationNodeDatum>) => (d.target as SymptomNode).y ?? 0);

      node.attr('transform', (d: d3.SimulationNodeDatum) => `translate(${(d as SymptomNode).x ?? 0},${(d as SymptomNode).y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [buildGraphData, onNodeClick, prioritizedDiagnosis, loading, token]);

  const handleExcludeDiagnosis = (diagnosisName: string) => {
    setExcludedDiagnoses(prev => new Set([...prev, diagnosisName]));
    onExcludeDiagnosis?.(diagnosisName);
  };

  const handlePrioritizeDiagnosis = (diagnosisName: string) => {
    setPrioritizedDiagnosis(diagnosisName);
    onPrioritizeDiagnosis?.(diagnosisName);
  };

  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const currentTransform = d3.zoomTransform(svgRef.current);
      const newTransform = currentTransform.scale(zoomLevel * 1.2);
      svg.transition().duration(300).call(
        d3.zoom<SVGSVGElement, unknown>().transform,
        newTransform
      );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const currentTransform = d3.zoomTransform(svgRef.current);
      const newTransform = currentTransform.scale(zoomLevel * 0.8);
      svg.transition().duration(300).call(
        d3.zoom<SVGSVGElement, unknown>().transform,
        newTransform
      );
    }
  };

  const getLegendItems = () => [
    { color: token.colorError, label: '当前症状', icon: <InfoCircleOutlined /> },
    { color: token.colorPrimary, label: '伴随症状', icon: <BranchesOutlined /> },
    { color: '#722ed1', label: '鉴别诊断', icon: <QuestionCircleOutlined /> },
    { color: token.colorWarning, label: '警惕征象', icon: <WarningOutlined /> },
    { color: token.colorSuccess, label: '支持关联', icon: <CheckCircleOutlined /> },
    { color: token.colorError, label: '排除关联', icon: <CloseCircleOutlined /> }
  ];

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.7) return 'success';
    if (confidence > 0.4) return 'warning';
    return 'default';
  };

  const getConfidenceProgressStatus = (confidence: number) => {
    if (confidence > 0.7) return 'success';
    if (confidence > 0.4) return 'active';
    return 'normal';
  };

  const getPriorityFromConfidence = (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence > 0.7) return 'high';
    if (confidence > 0.4) return 'medium';
    return 'low';
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ padding: 24 }}>
          <Skeleton paragraph={{ rows: 8 }} />
        </div>
      );
    }

    if (!currentSymptom && !associatedSymptoms.length && !differentialDiagnoses.length && !redFlags.length) {
      return (
        <Empty 
          description="暂无症状数据" 
          style={{ padding: 48 }}
        />
      );
    }

    return (
      <>
        <div ref={containerRef} style={{ 
          height: 400, 
          position: 'relative', 
          background: token.colorBgLayout,
          borderRadius: 8,
          border: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden'
        }}>
          <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
          
          <div style={{ 
            position: 'absolute', 
            top: 12, 
            left: 12, 
            background: token.colorBgElevated,
            padding: 12,
            borderRadius: 8,
            boxShadow: token.boxShadowSecondary,
            opacity: 0.95
          }}>
            <Text strong style={{ fontSize: 12, color: token.colorText }}>图例</Text>
            <div style={{ marginTop: 8 }}>
              {getLegendItems().map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ 
                    width: 14, 
                    height: 14, 
                    backgroundColor: item.color, 
                    borderRadius: '50%',
                    marginRight: 8,
                    boxShadow: `0 2px 4px ${item.color}40`
                  }} />
                  <Text style={{ fontSize: 11, color: token.colorTextSecondary }}>{item.label}</Text>
                </div>
              ))}
            </div>
          </div>

          <div style={{ 
            position: 'absolute', 
            bottom: 12, 
            left: 12,
            display: 'flex',
            gap: 8
          }}>
            <Tooltip title="放大">
              <Button 
                icon={<ZoomInOutlined />} 
                onClick={handleZoomIn} 
                shape="circle"
                style={{ boxShadow: token.boxShadow }}
              />
            </Tooltip>
            <Tooltip title="缩小">
              <Button 
                icon={<ZoomOutOutlined />} 
                onClick={handleZoomOut} 
                shape="circle"
                style={{ boxShadow: token.boxShadow }}
              />
            </Tooltip>
            <Tooltip title="全屏">
              <Button 
                icon={<FullscreenOutlined />} 
                onClick={() => {}} 
                shape="circle"
                style={{ boxShadow: token.boxShadow }}
              />
            </Tooltip>
          </div>
        </div>

        {differentialDiagnoses.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <Title level={5} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <QuestionCircleOutlined style={{ color: '#722ed1' }} />
              鉴别诊断排序
              {excludedDiagnoses.size > 0 && (
                <Tag color="default" style={{ marginLeft: 8 }}>
                  已排除 {excludedDiagnoses.size} 项
                </Tag>
              )}
            </Title>
            <div style={{ 
              background: token.colorBgLayout, 
              borderRadius: 8, 
              padding: 8,
              border: `1px solid ${token.colorBorderSecondary}`
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {differentialDiagnoses.filter(d => !excludedDiagnoses.has(d.name)).map((diagnosis) => {
                  const priority = getPriorityFromConfidence(diagnosis.confidence);
                  const config = PRIORITY_CONFIG[priority];

                  return (
                    <div
                      key={diagnosis.name}
                      style={{ 
                        background: token.colorBgContainer,
                        borderRadius: 6,
                        border: `1px solid ${config.borderColor}`,
                        transition: 'all 0.3s ease',
                        padding: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 500, color: token.colorText }}>{diagnosis.name}</span>
                            <Tag color={getConfidenceColor(diagnosis.confidence)}>
                              {(diagnosis.confidence * 100).toFixed(1)}%
                            </Tag>
                          </div>

                          <div style={{ marginTop: 6 }}>
                            <Progress 
                              percent={diagnosis.confidence * 100} 
                              size="small" 
                              status={getConfidenceProgressStatus(diagnosis.confidence)}
                              showInfo={true}
                              strokeColor={diagnosis.confidence > 0.7 ? token.colorSuccess : diagnosis.confidence > 0.4 ? token.colorWarning : token.colorBorder}
                              railColor={token.colorFillSecondary}
                            />
                            <div style={{ marginTop: 6, fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              <Text type="secondary">
                                <CheckCircleOutlined style={{ color: token.colorSuccess, marginRight: 4 }} />
                                支持: {diagnosis.supportingSymptoms.join(', ') || '无'}
                              </Text>
                              <Text type="secondary">
                                <CloseCircleOutlined style={{ color: token.colorError, marginRight: 4 }} />
                                排除: {diagnosis.excludingSymptoms.join(', ') || '无'}
                              </Text>
                            </div>
                          </div>
                        </div>

                        <Space>
                          <Button 
                            type={prioritizedDiagnosis === diagnosis.name ? 'primary' : 'text'}
                            size="small"
                            onClick={() => handlePrioritizeDiagnosis(diagnosis.name)}
                            icon={config.icon}
                            style={{ 
                              color: prioritizedDiagnosis === diagnosis.name ? '#fff' : config.color 
                            }}
                          >
                            优先
                          </Button>
                          <Button 
                            type="text" 
                            size="small" 
                            danger 
                            icon={<CloseCircleOutlined />}
                            onClick={() => handleExcludeDiagnosis(diagnosis.name)}
                          >
                            排除
                          </Button>
                        </Space>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return renderContent();
};

export default SymptomGraph;
