import { Textarea as MantineTextarea, TextareaProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const TextArea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, value, ...rest }, ref) => {
  return (
    <MantineTextarea
      ref={ref}
      className={className}
      placeholder={typeof rest.label === 'string' ? rest.label : undefined}
      value={value ?? undefined}
      {...rest}
    />
  );
});

export default makeComponentHookable(TextArea);
