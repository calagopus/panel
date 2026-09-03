import { FlexProps, Flex as MantineFlex } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Flex = forwardRef<HTMLDivElement, FlexProps>(({ ...rest }, ref) => {
  return <MantineFlex ref={ref} {...rest} />;
});

export default makeComponentHookable(Flex);
