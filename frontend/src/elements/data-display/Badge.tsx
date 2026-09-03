import { BadgeProps, Badge as MantineBadge } from '@mantine/core';
import classNames from 'classnames';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Badge = forwardRef<HTMLDivElement, BadgeProps>(({ className, ...rest }, ref) => {
  return <MantineBadge ref={ref} className={classNames(className, 'font-semibold!')} {...rest} />;
});

export default makeComponentHookable(Badge);
