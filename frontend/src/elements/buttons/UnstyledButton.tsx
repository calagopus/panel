import { UnstyledButton as MantineUnstyledButton, UnstyledButtonProps } from '@mantine/core';
import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const UnstyledButton = forwardRef<HTMLButtonElement, UnstyledButtonProps & ComponentPropsWithoutRef<'button'>>(
  ({ ...rest }, ref) => {
    return <MantineUnstyledButton ref={ref} {...rest} />;
  },
);

export default makeComponentHookable(UnstyledButton);
