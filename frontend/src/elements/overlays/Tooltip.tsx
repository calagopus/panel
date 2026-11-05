import { Tooltip as MantineTooltip, TooltipProps } from '@mantine/core';
import classNames from 'classnames';
import { Children, cloneElement, forwardRef, isValidElement, ReactNode } from 'react';
import { makeComponentHookable } from 'shared';

type LabelableProps = { 'aria-label'?: string; children?: ReactNode };

const hasTextContent = (node: ReactNode) =>
  Children.toArray(node).some((child) => typeof child === 'string' || typeof child === 'number');

// mantine names the wrapper span, not the trigger, so icon-only triggers would have no accessible name
const withAccessibleName = (children: ReactNode, label: TooltipProps['label']) => {
  if (typeof label !== 'string' || !isValidElement<LabelableProps>(children)) return children;
  if (children.props['aria-label'] || hasTextContent(children.props.children)) return children;

  return cloneElement(children, { 'aria-label': label });
};

type Props = TooltipProps & {
  innerClassName?: string;
  // the child must forward its ref to a DOM node and never be disabled, disabled elements emit no hover events
  unwrapped?: boolean;
};

const Tooltip = forwardRef<HTMLDivElement, Props>(
  ({ children, className, innerClassName, unwrapped, ...rest }, ref) => {
    if (unwrapped && isValidElement<{ className?: string }>(children)) {
      const child = innerClassName
        ? cloneElement(children, { className: classNames(children.props.className, innerClassName) })
        : children;

      return (
        <MantineTooltip ref={ref} className={className} {...rest}>
          {withAccessibleName(child, rest.label)}
        </MantineTooltip>
      );
    }

    return (
      <MantineTooltip
        ref={ref}
        className={classNames(className, 'w-fit', rest.multiline ? 'leading-snug' : 'leading-none')}
        {...rest}
      >
        <span className={classNames(innerClassName, 'inline-block')}>{withAccessibleName(children, rest.label)}</span>
      </MantineTooltip>
    );
  },
);

export default makeComponentHookable(Tooltip);
