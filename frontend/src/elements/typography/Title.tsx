import { Title as MantineTitle, TitleProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Title = forwardRef<HTMLHeadingElement, TitleProps>(({ ...rest }, ref) => {
  return <MantineTitle ref={ref} {...rest} />;
});

export default makeComponentHookable(Title);
