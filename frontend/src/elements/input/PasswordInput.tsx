import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { PasswordInput as MantinePasswordInput, PasswordInputProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const VisibilityToggleIcon = ({ reveal }: { reveal: boolean }) =>
  reveal ? (
    <FontAwesomeIcon icon={faEyeSlash} className='text-(--mantine-color-text)' />
  ) : (
    <FontAwesomeIcon icon={faEye} className='text-(--mantine-color-text)' />
  );

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({ className, value, ...rest }, ref) => {
  return (
    <MantinePasswordInput
      ref={ref}
      className={className}
      value={value ?? undefined}
      placeholder={typeof rest.label === 'string' ? rest.label : undefined}
      visibilityToggleIcon={VisibilityToggleIcon}
      {...rest}
    />
  );
});

export default makeComponentHookable(PasswordInput);
