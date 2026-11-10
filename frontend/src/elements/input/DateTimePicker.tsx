import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { DateTimePickerProps, DateTimePicker as MantineDateTimePicker } from '@mantine/dates';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';
import '@mantine/dates/styles.css';

const DateTimePicker = forwardRef<HTMLButtonElement, DateTimePickerProps>(({ className, ...rest }, ref) => {
  return (
    <MantineDateTimePicker
      ref={ref}
      className={className}
      placeholder={typeof rest.label === 'string' ? rest.label : undefined}
      leftSection={<FontAwesomeIcon icon={faCalendarDays} />}
      {...rest}
    />
  );
});

export default makeComponentHookable(DateTimePicker);
