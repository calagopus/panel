import { ReactNode } from 'react';
import Card from '@/elements/data-display/Card.tsx';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';
import SemiCircleProgress from '@/elements/feedback/SemiCircleProgress.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { usageColor } from '@/lib/format/usage.ts';

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
  icon: IconLike;
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
            label={unlimited ? '∞' : <>{percent.toFixed(1)}%</>}
            filledSegmentColor={unlimited ? 'gray' : usageColor(allocated, limit)}
          />
        </div>
        <div className='flex flex-col text-center md:text-right flex-1'>
          <Title order={2}>
            <Icon icon={icon} /> {label}
          </Title>
          <Text fw={500}>
            {unlimited ? (
              formatValue(allocated)
            ) : (
              <>
                {formatValue(allocated)} / {formatValue(limit)}
              </>
            )}
          </Text>
          {unlimited ? (
            <Text size='xs' c='dimmed'>
              {footer ?? noLimitLabel}
            </Text>
          ) : (
            footer
          )}
        </div>
      </div>
    </Card>
  );
}
