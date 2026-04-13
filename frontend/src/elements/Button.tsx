import { Button as MantineButton, ButtonProps as MantineButtonProps } from '@mantine/core';
import { forwardRef, MouseEvent as ReactMouseEvent } from 'react';
import { makeComponentHookable } from 'shared';

export interface ButtonProps extends Omit<MantineButtonProps, 'onClick'> {
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void | Promise<void>;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, type, onClick, loading, disabled, variant = 'filled', ...rest }, ref) => {
    return (
      <MantineButton
        ref={ref}
        type={type}
        className={className}
        onClick={onClick}
        loading={disabled ? false : loading}
        disabled={disabled}
        variant={variant}
        {...rest}
        style={{
          cursor: loading ? 'wait' : undefined,
          fontWeight: 'normal',
          border: disabled ? '1px solid var(--mantine-color-dark-4)' : undefined,
          color: disabled ? 'var(--mantine-color-dimmed)' : undefined,
          ...rest.style,
        }}
      >
        {children}
      </MantineButton>
    );
  },
);

export default makeComponentHookable(Button);
