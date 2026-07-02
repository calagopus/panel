import { TimeInput as MantineTimeInput, TimeInputProps } from '@mantine/dates';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(({ className, ...rest }, ref) => {
  return (
    <MantineTimeInput
      ref={ref}
      className={className}
      placeholder={typeof rest.label === 'string' ? rest.label : undefined}
      {...rest}
    />
  );
});

export default makeComponentHookable(TimeInput);
