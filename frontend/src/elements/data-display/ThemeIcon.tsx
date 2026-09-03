import { ThemeIcon as MantineThemeIcon, ThemeIconProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const ThemeIcon = forwardRef<HTMLDivElement, ThemeIconProps>(({ ...rest }, ref) => {
  return <MantineThemeIcon ref={ref} {...rest} />;
});

export default makeComponentHookable(ThemeIcon);
