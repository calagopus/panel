import { Notification as MantineNotification, NotificationProps } from '@mantine/core';
import { forwardRef } from 'react';

const Notification = forwardRef<HTMLDivElement, NotificationProps>(({ className, ...rest }, ref) => {
  return (
    <div className='pt-2 px-12'>
      <MantineNotification ref={ref} className={className} radius='md' withCloseButton={false} {...rest} />
    </div>
  );
});

export default Notification;
