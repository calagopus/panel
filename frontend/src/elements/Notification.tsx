import { Notification as MantineNotification, NotificationProps } from '@mantine/core';
import { forwardRef } from 'react';

const Notification = forwardRef<HTMLDivElement, NotificationProps>(({ className, ...rest }, ref) => {
  return <MantineNotification ref={ref} className={className} radius='md' withCloseButton={false} {...rest} />;
});

export default Notification;
