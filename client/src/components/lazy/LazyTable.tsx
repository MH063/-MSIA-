import React, { Suspense } from 'react';
import Loading from '../common/Loading';
type AnyProps = Record<string, unknown>;

const TableLazy = React.lazy(async () => {
  const mod = await import('antd/es/table');
  return { default: mod.default as unknown as React.ComponentType<AnyProps> };
});

const LazyTable: React.FC<AnyProps> = (props) => {
  return (
    <Suspense fallback={<Loading height={200} />}>
      <TableLazy {...props} />
    </Suspense>
  );
};

export default LazyTable;
