import { useMemo, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';

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

interface UseSymptomGraphOptions {
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
  excludedDiagnoses: Set<string>;
  prioritizedDiagnosis: string | null;
}

interface GraphData {
  nodes: SymptomNode[];
  links: SymptomLink[];
}

export const useSymptomGraph = (options: UseSymptomGraphOptions): GraphData => {
  const {
    currentSymptom,
    associatedSymptoms,
    differentialDiagnoses,
    redFlags,
    excludedDiagnoses,
    prioritizedDiagnosis,
  } = options;

  // 使用 useMemo 缓存图数据，避免每次渲染都重新计算
  return useMemo(() => {
    const nodes: SymptomNode[] = [];
    const links: SymptomLink[] = [];

    // 添加当前症状节点
    nodes.push({
      id: 'current',
      name: currentSymptom,
      type: 'current',
      confidence: 1,
    });

    // 添加伴随症状节点
    associatedSymptoms.forEach((symptom, index) => {
      const nodeId = `associated_${index}`;
      nodes.push({
        id: nodeId,
        name: symptom,
        type: 'associated',
      });
      links.push({
        source: 'current',
        target: nodeId,
        type: 'association',
        strength: 0.5,
      });
    });

    // 添加鉴别诊断节点
    differentialDiagnoses
      .filter(d => !excludedDiagnoses.has(d.name))
      .forEach((diagnosis, index) => {
        const nodeId = `diagnosis_${index}`;
        const isPrioritized = prioritizedDiagnosis === diagnosis.name;
        
        nodes.push({
          id: nodeId,
          name: diagnosis.name,
          type: 'differential',
          confidence: isPrioritized ? Math.min(diagnosis.confidence + 0.2, 1) : diagnosis.confidence,
        });

        // 添加支持症状链接
        diagnosis.supportingSymptoms.forEach(symptom => {
          const associatedIndex = associatedSymptoms.indexOf(symptom);
          if (associatedIndex !== -1) {
            links.push({
              source: `associated_${associatedIndex}`,
              target: nodeId,
              type: 'support',
              strength: 0.7,
            });
          }
        });
      });

    // 添加警惕征象节点
    redFlags.forEach((flag, index) => {
      const nodeId = `redflag_${index}`;
      nodes.push({
        id: nodeId,
        name: flag,
        type: 'redFlag',
      });
      links.push({
        source: 'current',
        target: nodeId,
        type: 'redFlag',
        strength: 0.9,
      });
    });

    return { nodes, links };
  }, [
    currentSymptom,
    associatedSymptoms,
    differentialDiagnoses,
    redFlags,
    excludedDiagnoses,
    prioritizedDiagnosis,
  ]);
};

// 使用 ref 缓存 D3 实例，避免重复创建
export const useD3Instance = () => {
  const simulationRef = useRef<d3.Simulation<SymptomNode, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    simulationRef,
    zoomRef,
    cleanup,
  };
};
