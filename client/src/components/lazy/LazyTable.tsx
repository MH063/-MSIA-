import React, { Suspense } from 'react';
type AnyProps = Record<string, unknown>;

const TableLazy = React.lazy(async () => {
  const mod = await import('antd/es/table');
  return { default: mod.default as unknown as React.ComponentType<AnyProps> };
});

const LazyTable: React.FC<AnyProps> = (props) => {
  return (
    <Suspense fallback={<div style={{ padding: 12 }}>表格加载中…</div>}>
      <TableLazy {...props} />
    </Suspense>
  );
};

export default LazyTable;
