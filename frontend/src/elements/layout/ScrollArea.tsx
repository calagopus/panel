import { ScrollArea as MantineScrollArea, ScrollAreaProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(({ ...rest }, ref) => {
  return <MantineScrollArea ref={ref} {...rest} />;
});

export default makeComponentHookable(ScrollArea);
