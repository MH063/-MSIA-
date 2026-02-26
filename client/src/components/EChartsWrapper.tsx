import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useThemeStore } from '../store/theme.store';

interface EChartsWrapperProps {
  option: echarts.EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  loading?: boolean;
  onEvents?: Record<string, (params: unknown) => void>;
}

/**
 * ECharts 包装组件
 * 负责实例初始化、主题切换、事件绑定与资源释放
 */
const EChartsWrapper: React.FC<EChartsWrapperProps> = ({
  option,
  style = { height: '300px', width: '100%' },
  className,
  loading = false,
  onEvents
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const optionRef = useRef<echarts.EChartsOption>(option);
  const { mode } = useThemeStore();

  optionRef.current = option;

  useEffect(() => {
    if (chartRef.current) {
      const theme = mode === 'dark' ? 'dark' : undefined;
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }
      chartInstance.current = echarts.init(chartRef.current, theme);
      
      chartInstance.current.setOption(optionRef.current);

      const resizeObserver = new ResizeObserver(() => {
        chartInstance.current?.resize();
      });
      resizeObserver.observe(chartRef.current);

      setTimeout(() => {
        chartInstance.current?.resize();
      }, 100);

      return () => {
        resizeObserver.disconnect();
        if (chartInstance.current) {
          chartInstance.current.dispose();
          chartInstance.current = null;
        }
      };
    }
  }, [mode]);

  useEffect(() => {
    if (chartInstance.current && onEvents) {
      // 先解绑所有可能的事件
      const eventNames = Object.keys(onEvents);
      eventNames.forEach(eventName => {
        chartInstance.current?.off(eventName);
      });
      // 绑定新事件
      Object.entries(onEvents).forEach(([eventName, handler]) => {
        chartInstance.current?.on(eventName, handler);
      });
    }
  }, [onEvents]);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.setOption(option);
    }
  }, [option]);

  useEffect(() => {
    if (chartInstance.current) {
      if (loading) {
        chartInstance.current.showLoading();
      } else {
        chartInstance.current.hideLoading();
      }
    }
  }, [loading]);

  return <div ref={chartRef} style={style} className={className} />;
};

export default EChartsWrapper;
