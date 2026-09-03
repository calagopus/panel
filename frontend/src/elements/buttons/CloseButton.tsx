import { CloseButtonProps, CloseButton as MantineCloseButton } from '@mantine/core';
import { forwardRef, MouseEvent as ReactMouseEvent } from 'react';
import { makeComponentHookable } from 'shared';

export interface ButtonProps extends Omit<CloseButtonProps, 'onClick'> {
  onClick?: (event: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void | Promise<void>;
}

const CloseButton = forwardRef<HTMLButtonElement, ButtonProps>(({ children, className, onClick, ...rest }, ref) => {
  return (
    <MantineCloseButton ref={ref} className={className} onClick={onClick} {...rest}>
      {children}
    </MantineCloseButton>
  );
});

export default makeComponentHookable(CloseButton);
