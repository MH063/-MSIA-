import React, { Suspense } from 'react';

export interface SuspenseWrapperProps {
  children: React.ReactNode;
}

/**
 * SuspenseWrapper
 * 为懒加载页面统一提供加载占位，提升用户体验
 */
const SuspenseWrapper: React.FC<SuspenseWrapperProps> = ({ children }) => {
  return <Suspense fallback={<div style={{ padding: 16 }}>加载中...</div>}>{children}</Suspense>;
};

export default SuspenseWrapper;
