import React, { Suspense } from 'react';
import type { DrawerProps } from 'antd/es/drawer';
const InnerDrawer = React.lazy(() => import('antd/es/drawer'));

/**
 * LazyDrawer
 * 懒加载封装的 Ant Design Drawer 组件，透传所有 DrawerProps。
 * 目的：降低首屏包体积；在需要时再加载 Drawer 相关代码。
 */
export default function LazyDrawer(props: DrawerProps) {
  return (
    <Suspense fallback={<div style={{ width: '100%', minHeight: 100 }} />}>
      <InnerDrawer {...props} />
    </Suspense>
  );
}
