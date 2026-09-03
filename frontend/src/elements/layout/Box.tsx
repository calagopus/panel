import { BoxProps, Box as MantineBox } from '@mantine/core';
import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Box = forwardRef<HTMLDivElement, BoxProps & ComponentPropsWithoutRef<'div'>>(({ ...rest }, ref) => {
  return <MantineBox ref={ref} {...rest} />;
});

export default makeComponentHookable(Box);
