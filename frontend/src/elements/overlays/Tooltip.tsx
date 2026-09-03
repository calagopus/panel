import { Tooltip as MantineTooltip, TooltipProps } from '@mantine/core';
import classNames from 'classnames';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Tooltip = forwardRef<HTMLDivElement, TooltipProps & { innerClassName?: string }>(
  ({ children, className, innerClassName, ...rest }, ref) => {
    return (
      <MantineTooltip ref={ref} className={classNames(className, 'w-fit leading-none')} {...rest}>
        <span className={classNames(innerClassName, 'inline-block')}>{children}</span>
      </MantineTooltip>
    );
  },
);

export default makeComponentHookable(Tooltip);
