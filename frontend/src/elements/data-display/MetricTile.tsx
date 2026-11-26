import { faCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Popover } from '@mantine/core';
import classNames from 'classnames';
import { ReactNode } from 'react';
import { SeriesKey } from '@/elements/charts/ChartLegend.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import Text from '@/elements/typography/Text.tsx';
import { StreamChartSeries } from '@/lib/chart.ts';
import { usageColor } from '@/lib/format/usage.ts';

export interface MetricTileRow {
  series: StreamChartSeries;
  label?: ReactNode;
  value: string;
  limit?: string | null;
  details?: string | null;
  progress?: number | null;
  total?: number | null;
}

export default function MetricTile({
  icon,
  label,
  order,
  className,
  value,
  limit,
  rows,
  progress,
  total,
  loading,
  action,
  popover,
  chart,
  chartVisible = true,
}: {
  icon: IconLike;
  label: string;
  order?: number;
  className?: string;
  value?: ReactNode;
  limit?: string | null;
  rows?: MetricTileRow[] | null;
  progress?: number | null;
  total?: number | null;
  loading?: boolean;
  action?: ReactNode;
  popover?: ReactNode;
  chart?: ReactNode;
  chartVisible?: boolean;
}) {
  const shownProgress = loading ? null : progress;

  return (
    <Card
      padding={0}
      className={classNames('flex min-w-0 flex-col', className)}
      style={{ order }}
      progress={shownProgress}
      total={total}
      progressColor={usageColor(shownProgress, total)}
      progressMargin={chart ? 0 : 'md'}
    >
      <div className={classNames('flex flex-col gap-1 px-4 pt-3', !chart && 'pb-3')}>
        <h3 className='flex min-w-0 items-center text-sm text-(--mantine-color-dimmed)'>
          <span className='mr-2 flex shrink-0 items-center'>
            <Icon icon={icon} />
          </span>
          <ScrollingText>{label}</ScrollingText>
          {action && <span className='ml-1 flex shrink-0 items-center'>{action}</span>}
          {popover && (
            <Popover position='bottom' withArrow shadow='md'>
              <Popover.Target>
                <button
                  type='button'
                  className='ml-1 inline-flex shrink-0 cursor-pointer p-1 hover:text-(--mantine-color-text)'
                >
                  <FontAwesomeIcon icon={faCog} size='sm' />
                </button>
              </Popover.Target>
              <Popover.Dropdown>{popover}</Popover.Dropdown>
            </Popover>
          )}
        </h3>
        {loading ? (
          <span className='flex h-7 items-center'>
            <Spinner size={18} />
          </span>
        ) : (
          value !== undefined &&
          value !== null && (
            <span className='text-lg font-bold tabular-nums'>
              <ScrollingText>
                {value} {limit && <span className='text-sm text-(--mantine-color-dimmed)'>/ {limit}</span>}
              </ScrollingText>
            </span>
          )
        )}
        {!loading &&
          rows?.map((row) => (
            <div key={row.series.key} className='flex gap-1.5'>
              <span className='flex h-5 shrink-0 items-center'>
                <SeriesKey entry={row.series} />
              </span>
              <div className='flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3'>
                <span className='text-sm whitespace-nowrap'>
                  <span className='text-(--mantine-color-dimmed)'>{row.label ?? row.series.label}</span>{' '}
                  <Text
                    component='span'
                    inherit
                    fw={700}
                    c={usageColor(row.progress, row.total)}
                    className='tabular-nums'
                  >
                    {row.value}
                  </Text>
                  {row.limit && <span className='text-xs text-(--mantine-color-dimmed)'> / {row.limit}</span>}
                </span>
                {row.details && (
                  <span className='text-xs whitespace-nowrap text-(--mantine-color-dimmed) tabular-nums'>
                    {row.details}
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
      {chart && (
        <div className='relative mt-2 min-h-16 flex-1 xl:min-h-8'>
          {chartVisible && <div className='absolute inset-0'>{chart}</div>}
        </div>
      )}
    </Card>
  );
}
