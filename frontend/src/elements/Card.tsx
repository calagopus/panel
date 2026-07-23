import { Card as MantineCard, CardProps as MantineCardProps, MantineColor, Progress } from '@mantine/core';
import classNames from 'classnames';
import { ComponentProps, forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

export function usagePercent(progress?: number | null, total?: number | null): number | null {
  return typeof progress === 'number' && typeof total === 'number' && total > 0
    ? Math.min(100, Math.max(0, (progress / total) * 100))
    : null;
}

export function usageColor(progress?: number | null, total?: number | null): MantineColor | undefined {
  const percent = usagePercent(progress, total);
  if (percent === null) return undefined;
  if (percent >= 100) return 'red';
  if (percent >= 80) return 'yellow';
  return undefined;
}

export interface CardProps extends MantineCardProps {
  hoverable?: boolean;
  leftStripeClassName?: string;
  progress?: number | null;
  total?: number | null;
}

const Card = forwardRef<HTMLDivElement, CardProps & ComponentProps<'div'>>(
  ({ className, pl, hoverable = false, leftStripeClassName, progress, total, children, ...rest }, ref) => {
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
            <Progress value={percent} color={usageColor(progress, total)} size='sm' radius={0} />
          </MantineCard.Section>
        )}
      </MantineCard>
    );
  },
);

export default makeComponentHookable(Card);
