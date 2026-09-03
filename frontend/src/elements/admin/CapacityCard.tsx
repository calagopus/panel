import { ReactNode } from 'react';
import Card from '@/elements/data-display/Card.tsx';
import SemiCircleProgress from '@/elements/feedback/SemiCircleProgress.tsx';
import Title from '@/elements/typography/Title.tsx';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';

const defaultFormatValue = (value: number) => bytesToString(mbToBytes(value));

export default function CapacityCard({
  label,
  icon,
  allocated,
  limit,
  footer,
  noLimitLabel,
  formatValue = defaultFormatValue,
}: {
  label: string;
  icon: ReactNode;
  allocated: number;
  limit: number;
  footer?: ReactNode;
  noLimitLabel?: ReactNode;
  formatValue?: (value: number) => ReactNode;
}) {
  const percent = limit > 0 ? (allocated / limit) * 100 : 0;
  const unlimited = limit === 0;

  return (
    <Card>
      <div className='flex flex-col md:flex-row gap-4 md:items-center'>
        <div className='flex justify-center md:flex-1'>
          <SemiCircleProgress
            value={unlimited ? 100 : Math.min(percent, 100)}
            label={unlimited ? '--' : <>{percent.toFixed(1)}%</>}
            filledSegmentColor={unlimited ? 'gray' : percent >= 90 ? 'red' : undefined}
          />
        </div>
        <div className='flex flex-col text-center md:text-right flex-1'>
          <Title order={2}>
            {icon} {label}
          </Title>
          <h2>
            {unlimited ? (
              formatValue(allocated)
            ) : (
              <>
                {formatValue(allocated)} / {formatValue(limit)}
              </>
            )}
          </h2>
          {unlimited ? <p className='text-xs'>{footer ?? noLimitLabel}</p> : footer}
        </div>
      </div>
    </Card>
  );
}
