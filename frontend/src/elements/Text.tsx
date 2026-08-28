import { Text as MantineText, TextProps } from '@mantine/core';
import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

type TextElementProps = TextProps &
  ComponentPropsWithoutRef<'p'> & {
    component?: React.ElementType;
  };

const Text = forwardRef<HTMLParagraphElement, TextElementProps>(({ component, ...rest }, ref) => {
  return (
    <MantineText
      ref={ref as React.Ref<HTMLParagraphElement>}
      {...(component ? { component: component as 'p' } : {})}
      {...rest}
    />
  );
});

export default makeComponentHookable(Text);
