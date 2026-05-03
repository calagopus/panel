import { Switch as MantineSwitch, SwitchProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Switch = forwardRef<HTMLInputElement, SwitchProps>(({ className, description, ...rest }, ref) => {
  return (
    <div className='flex flex-col gap-1'>
      <MantineSwitch ref={ref} className={className} {...rest} />
      {description && <p className='text-(--mantine-color-dimmed)! text-xs'>{description}</p>}
    </div>
  );
});

export default makeComponentHookable(Switch);
