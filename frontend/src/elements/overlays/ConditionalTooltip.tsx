import classNames from 'classnames';
import React, { cloneElement, forwardRef, isValidElement } from 'react';
import { makeComponentHookable } from 'shared';
import Tooltip from '@/elements/overlays/Tooltip.tsx';

export interface TooltipProps extends React.ComponentProps<typeof Tooltip> {
  enabled: boolean;
  innerClassName?: string;
}

const ConditionalTooltip = forwardRef<HTMLDivElement, TooltipProps>(
  ({ children, className, innerClassName, enabled, ...rest }, ref) => {
    if (enabled) {
      return (
        <Tooltip ref={ref} className={className} innerClassName={innerClassName} {...rest}>
          {children}
        </Tooltip>
      );
    }

    if (rest.unwrapped && isValidElement<{ className?: string }>(children)) {
      return cloneElement(children, { className: classNames(children.props.className, className, innerClassName) });
    }

    return <span className={classNames(className, innerClassName, 'inline-block')}>{children}</span>;
  },
);

export default makeComponentHookable(ConditionalTooltip);
