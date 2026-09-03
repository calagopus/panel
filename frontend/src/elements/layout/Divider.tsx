import { DividerProps, Divider as MantineDivider } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Divider = forwardRef<HTMLDivElement, DividerProps>(({ className, ...rest }, ref) => {
  return <MantineDivider ref={ref} className={className} {...rest} />;
});

export default makeComponentHookable(Divider);
