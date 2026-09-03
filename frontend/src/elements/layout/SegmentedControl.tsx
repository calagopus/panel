import { SegmentedControl as MantineSegmentedControl, SegmentedControlProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(({ className, ...rest }, ref) => {
  return <MantineSegmentedControl ref={ref} className={className} {...rest} />;
});

export default makeComponentHookable(SegmentedControl);
