import { AlertProps, Alert as MantineAlert } from '@mantine/core';
import classNames from 'classnames';
import { deepmerge } from 'deepmerge-ts';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Alert = forwardRef<HTMLDivElement, AlertProps>(({ className, styles, ...rest }, ref) => {
  return (
    <MantineAlert
      ref={ref}
      className={classNames(className, 'text-2xl')}
      styles={deepmerge(styles, { wrapper: { width: '100%' }, icon: { alignSelf: 'center' } })}
      {...rest}
    />
  );
});

export default makeComponentHookable(Alert);
