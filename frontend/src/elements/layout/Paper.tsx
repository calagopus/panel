import { Paper as MantinePaper, PaperProps } from '@mantine/core';
import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Paper = forwardRef<HTMLDivElement, PaperProps & ComponentPropsWithoutRef<'div'>>(({ ...rest }, ref) => {
  return <MantinePaper ref={ref} {...rest} />;
});

export default makeComponentHookable(Paper);
