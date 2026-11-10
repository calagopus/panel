import { TimePicker as MantineTimePicker, TimePickerProps } from '@mantine/dates';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';
import '@mantine/dates/styles.css';

const TimePicker = forwardRef<HTMLDivElement, TimePickerProps>(({ className, ...rest }, ref) => {
  return <MantineTimePicker ref={ref} className={className} {...rest} />;
});

export default makeComponentHookable(TimePicker);
