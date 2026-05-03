import { Card as MantineCard, CardProps as MantineCardProps } from '@mantine/core';
import classNames from 'classnames';
import { ComponentProps, forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

export interface CardProps extends MantineCardProps {
  hoverable?: boolean;
  leftStripeClassName?: string;
}

const Card = forwardRef<HTMLDivElement, CardProps & ComponentProps<'div'>>(
  ({ className, pl, hoverable = false, leftStripeClassName, children, ...rest }, ref) => {
    return (
      <MantineCard
        ref={ref}
        className={classNames(
          'relative',
          className,
          hoverable && 'transition-all! duration-190 hover:border-(--mantine-color-default-border)/20! cursor-pointer',
        )}
        pl={typeof pl === 'number' && leftStripeClassName ? pl + 4 : leftStripeClassName ? 20 : pl}
        radius='md'
        withBorder
        {...rest}
      >
        {leftStripeClassName && (
          <div className={classNames('absolute left-0 top-0 h-full w-1 mr-1', leftStripeClassName)} />
        )}
        {children}
      </MantineCard>
    );
  },
);

export default makeComponentHookable(Card);
