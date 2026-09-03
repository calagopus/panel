import { Stack as MantineStack, StackProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Stack = forwardRef<HTMLDivElement, StackProps>(({ ...rest }, ref) => {
  return <MantineStack ref={ref} {...rest} />;
});

export default makeComponentHookable(Stack);
