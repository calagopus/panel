import { DatePickerProps, DatePicker as MantineDatePicker } from '@mantine/dates';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';
import '@mantine/dates/styles.css';

const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(({ className, ...rest }, ref) => {
  return <MantineDatePicker ref={ref} className={className} {...rest} />;
});

export default makeComponentHookable(DatePicker);
