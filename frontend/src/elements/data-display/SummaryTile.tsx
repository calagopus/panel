import classNames from 'classnames';
import { ReactNode } from 'react';
import Card from '@/elements/data-display/Card.tsx';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';

export interface SummaryTileRow {
  key: string;
  label: ReactNode;
  value: ReactNode;
}

export default function SummaryTile({
  icon,
  label,
  value,
  caption,
  rows,
  loading,
  order,
  className,
}: {
  icon: IconLike;
  label: string;
  value: ReactNode;
  caption?: string | null;
  rows?: SummaryTileRow[] | null;
  loading?: boolean;
  order?: number;
  className?: string;
}) {
  return (
    <Card padding={0} className={classNames('flex h-full min-w-0 flex-col', className)} style={{ order }}>
      <div className='flex flex-1 flex-col gap-1 px-4 py-3'>
        <h3 className='flex min-w-0 items-center text-sm text-(--mantine-color-dimmed)'>
          <span className='mr-2 flex shrink-0 items-center'>
            <Icon icon={icon} />
          </span>
          <ScrollingText>{label}</ScrollingText>
        </h3>
        {loading ? (
          <span className='flex h-7 items-center'>
            <Spinner size={18} />
          </span>
        ) : (
          <>
            <span className='text-lg font-bold tabular-nums'>
              <ScrollingText>
                {value}{' '}
                {caption && <span className='text-xs font-normal text-(--mantine-color-dimmed)'>{caption}</span>}
              </ScrollingText>
            </span>
            {rows && rows.length > 0 && (
              <div className='mt-1 flex flex-col gap-0.5 border-t border-(--mantine-color-default-border) pt-2'>
                {rows.map((row) => (
                  <div key={row.key} className='flex items-baseline justify-between gap-3 text-sm'>
                    <span className='flex min-w-0 items-center gap-1.5 truncate text-(--mantine-color-dimmed)'>
                      {row.label}
                    </span>
                    <span className='shrink-0 font-semibold whitespace-nowrap tabular-nums'>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
