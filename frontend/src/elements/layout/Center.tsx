import { CenterProps, Center as MantineCenter } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Center = forwardRef<HTMLDivElement, CenterProps>(({ ...rest }, ref) => {
  return <MantineCenter ref={ref} {...rest} />;
});

export default makeComponentHookable(Center);
