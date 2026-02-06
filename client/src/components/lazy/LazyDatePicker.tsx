import React, { Suspense } from 'react';
type AnyProps = Record<string, unknown>;

const DatePickerLazy = React.lazy(async () => {
  const mod = await import('antd/es/date-picker');
  return { default: mod.default as unknown as React.ComponentType<AnyProps> };
});

const LazyDatePicker: React.FC<AnyProps> = (props) => {
  return (
    <Suspense fallback={<div style={{ height: 32 }} />}>
      <DatePickerLazy {...props} />
    </Suspense>
  );
};

export default LazyDatePicker;
