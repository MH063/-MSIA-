import React, { Suspense } from 'react';
import type { ModalProps } from 'antd/es/modal';
const InnerModal = React.lazy(() => import('antd/es/modal'));

/**
 * LazyModal
 * 懒加载封装的 Ant Design Modal 组件，透传所有 ModalProps。
 * 目的：降低首屏包体积；在需要时再加载 Modal 相关代码。
 */
export default function LazyModal(props: ModalProps) {
  return (
    <Suspense fallback={<div style={{ padding: 12 }} />}>
      <InnerModal {...props} />
    </Suspense>
  );
}
