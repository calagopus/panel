import { SemiCircleProgress as MantineSemiCircleProgress, SemiCircleProgressProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const SemiCircleProgress = forwardRef<HTMLDivElement, SemiCircleProgressProps>(({ className, ...rest }, ref) => {
  return <MantineSemiCircleProgress ref={ref} className={className} transitionDuration={100} {...rest} />;
});

export default makeComponentHookable(SemiCircleProgress);
