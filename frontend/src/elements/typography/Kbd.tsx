import { KbdProps, Kbd as MantineKbd } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Kbd = forwardRef<HTMLElement, KbdProps>(({ ...rest }, ref) => {
  return <MantineKbd ref={ref} {...rest} />;
});

export default makeComponentHookable(Kbd);
