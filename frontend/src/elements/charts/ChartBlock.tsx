import { ReactNode } from 'react';
import { makeComponentHookable } from 'shared';
import Card from '@/elements/data-display/Card.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';

function ChartBlock({
  icon,
  title,
  value,
  legend,
  overlayIcon,
  overlayLabel,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  value?: ReactNode;
  legend?: ReactNode;
  overlayIcon?: ReactNode;
  overlayLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card p={0} className={`relative flex min-w-0 flex-col ${className ?? ''}`}>
      <div className='@container border-b border-(--mantine-color-default-border) px-4 py-3'>
        <div className='flex flex-col items-start gap-1 @lg:flex-row @lg:items-center @lg:justify-between @lg:gap-2'>
          <h3 className='flex min-w-0 max-w-full items-center transition-colors duration-100'>
            <span className='mr-2 shrink-0'>{icon}</span>
            <ScrollingText>{title}</ScrollingText>
          </h3>
          {!overlayLabel && value !== undefined && value !== null && (
            <span className='shrink-0 text-sm tabular-nums'>{value}</span>
          )}
          {!overlayLabel && legend && (
            <span className='flex max-w-full flex-col items-start gap-1 text-sm @lg:flex-row @lg:items-center @lg:gap-3'>
              {legend}
            </span>
          )}
        </div>
      </div>
      <div className='min-h-60 flex-1 px-4 pt-4 pb-3'>
        {overlayLabel ? (
          <div className='flex h-full flex-col items-center justify-center gap-2 text-(--mantine-color-dimmed)'>
            {overlayIcon}
            <span className='text-sm'>{overlayLabel}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

export default makeComponentHookable(ChartBlock);
