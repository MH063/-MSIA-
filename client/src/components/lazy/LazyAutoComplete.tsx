import React, { Suspense } from 'react';
type AnyProps = Record<string, unknown>;

const AutoCompleteLazy = React.lazy(async () => {
  const mod = await import('antd/es/auto-complete');
  return { default: mod.default as unknown as React.ComponentType<AnyProps> };
});

const LazyAutoComplete: React.FC<AnyProps> = (props) => {
  return (
    <Suspense fallback={<div style={{ height: 32 }} />}>
      <AutoCompleteLazy {...props} />
    </Suspense>
  );
};

export default LazyAutoComplete;
