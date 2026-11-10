import { YearPicker as MantineYearPicker, YearPickerProps } from '@mantine/dates';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';
import '@mantine/dates/styles.css';

const YearPicker = forwardRef<HTMLDivElement, YearPickerProps>(({ className, ...rest }, ref) => {
  return <MantineYearPicker ref={ref} className={className} {...rest} />;
});

export default makeComponentHookable(YearPicker);
