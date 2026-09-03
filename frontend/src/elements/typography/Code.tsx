import { CodeProps, Code as MantineCode } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Code = forwardRef<HTMLPreElement, CodeProps>(({ children, className, ...rest }, ref) => {
  return (
    <MantineCode ref={ref} className={className} {...rest}>
      {children}
    </MantineCode>
  );
});

export default makeComponentHookable(Code);
