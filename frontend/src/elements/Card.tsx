import { Card as MantineCard, CardProps as MantineCardProps, MantineColor, Progress } from '@mantine/core';
import classNames from 'classnames';
import { ComponentProps, forwardRef } from 'react';
import { makeComponentHookable } from 'shared';
import { usagePercent } from '@/lib/usage.ts';

export interface CardProps extends MantineCardProps {
  hoverable?: boolean;
  leftStripeClassName?: string;
  progress?: number | null;
  total?: number | null;
  progressColor?: MantineColor;
}

const Card = forwardRef<HTMLDivElement, CardProps & ComponentProps<'div'>>(
  (
    { className, pl, hoverable = false, leftStripeClassName, progress, total, progressColor, children, ...rest },
    ref,
  ) => {
    const percent = usagePercent(progress, total);

    return (
      <MantineCard
        ref={ref}
        className={classNames(
          'relative',
          className,
          hoverable && 'transition-all! duration-190 hover:bg-white/2! hover:light:bg-black/3! cursor-pointer',
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
        {percent !== null && (
          <MantineCard.Section mt='md'>
            <Progress value={percent} color={progressColor} size='sm' radius={0} />
          </MantineCard.Section>
        )}
      </MantineCard>
    );
  },
);

export default makeComponentHookable(Card);
