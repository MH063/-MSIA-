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
  const { mode } = useThemeStore();

  useEffect(() => {
    if (chartRef.current) {
      const theme = mode === 'dark' ? 'dark' : undefined;
      // 销毁旧实例以防万一
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }
      chartInstance.current = echarts.init(chartRef.current, theme);

      const resizeObserver = new ResizeObserver(() => {
        chartInstance.current?.resize();
      });
      resizeObserver.observe(chartRef.current);

      // 初始 Resize (延迟以处理 Tab 切换动画)
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
      Object.entries(onEvents).forEach(([eventName, handler]) => {
        // 重新绑定事件以避免多次绑定
        chartInstance.current!.off(eventName);
        chartInstance.current!.on(eventName, handler);
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
