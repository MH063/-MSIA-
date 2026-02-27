import React, { Suspense } from 'react';
import { Spin } from 'antd';

type AnyProps = Record<string, unknown>;

const TableLazy = React.lazy(async () => {
  const mod = await import('antd/es/table');
  return { default: mod.default as unknown as React.ComponentType<AnyProps> };
});

const LazyTable: React.FC<AnyProps> = (props) => {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}><Spin /></div>}>
      <TableLazy {...props} />
    </Suspense>
  );
};

export default LazyTable;
