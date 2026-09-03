import { AvatarProps, Avatar as MantineAvatar, PolymorphicComponentProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Avatar = forwardRef<HTMLDivElement, PolymorphicComponentProps<'div', AvatarProps>>(
  ({ src, name, ...rest }, ref) => {
    return (
      <MantineAvatar
        ref={ref}
        src={src ?? (name ? null : '/icon.svg')}
        name={name}
        alt={name}
        color='initials'
        {...rest}
      />
    );
  },
);

export default makeComponentHookable(Avatar);
