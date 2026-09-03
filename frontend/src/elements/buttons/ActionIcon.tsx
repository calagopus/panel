import { ActionIconProps, ActionIcon as MantineActionIcon, PolymorphicComponentProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const ActionIcon = forwardRef<HTMLButtonElement, PolymorphicComponentProps<'button', ActionIconProps>>(
  ({ className, ...rest }, ref) => {
    return <MantineActionIcon ref={ref} className={className} {...rest} />;
  },
);

export default makeComponentHookable(ActionIcon);
