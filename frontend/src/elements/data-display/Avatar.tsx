import { AvatarProps, Avatar as MantineAvatar, PolymorphicComponentProps, useComputedColorScheme } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';
import { useGlobalStore } from '@/stores/global.ts';

const Avatar = forwardRef<HTMLDivElement, PolymorphicComponentProps<'div', AvatarProps>>(
  ({ src, name, ...rest }, ref) => {
    const isLight = useComputedColorScheme('dark') === 'light';
    const appIcon = useGlobalStore((state) =>
      isLight ? (state.settings.app.iconLight ?? state.settings.app.icon) : state.settings.app.icon,
    );

    return (
      <MantineAvatar ref={ref} src={src ?? (name ? null : appIcon)} name={name} alt={name} color='initials' {...rest} />
    );
  },
);

export default makeComponentHookable(Avatar);
