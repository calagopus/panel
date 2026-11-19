import { AlertProps, Alert as MantineAlert } from '@mantine/core';
import classNames from 'classnames';
import { deepmerge } from 'deepmerge-ts';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';

const Alert = forwardRef<HTMLDivElement, Omit<AlertProps, 'icon'> & { icon?: IconLike }>(
  ({ className, styles, icon, ...rest }, ref) => {
    return (
      <MantineAlert
        ref={ref}
        className={classNames(className, 'text-2xl')}
        styles={deepmerge(styles, {
          wrapper: { width: '100%' },
          body: { justifyContent: 'center' },
          icon: { alignSelf: 'center', marginTop: 0 },
        })}
        icon={icon && <Icon icon={icon} />}
        {...rest}
      />
    );
  },
);

export default makeComponentHookable(Alert);
