import { faCog, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { MantineColor, Popover } from '@mantine/core';
import classNames from 'classnames';
import { ReactNode } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Card from '@/elements/data-display/Card.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { usageColor } from '@/lib/format/usage.ts';

export default function StatCard({
  icon,
  label,
  value,
  order,
  className,
  copyOnClick,
  popover,
  popoverIcon = faCog,
  limit,
  details,
  progress,
  total,
  valueColor,
  redact,
}: {
  icon?: IconDefinition;
  label: string;
  value: string;
  order?: number;
  className?: string;
  copyOnClick?: boolean;
  popover?: ReactNode;
  popoverIcon?: IconDefinition;
  limit?: string | null;
  details?: string | null;
  progress?: number | null;
  total?: number | null;
  valueColor?: MantineColor;
  redact?: boolean;
}) {
  const displayValue = redact ? <RedactedText value={value} /> : value;
  const color = usageColor(progress, total);

  return (
    <Card className={className} style={{ order }} progress={progress} total={total} progressColor={color}>
      <div className='flex flex-row items-center'>
        {icon && (
          <ThemeIcon size='xl' radius='md' color={color}>
            <FontAwesomeIcon size='xl' icon={icon} />
          </ThemeIcon>
        )}
        <div className={classNames('flex flex-col w-full min-w-0', icon && 'ml-4')}>
          <div className='w-full flex justify-between items-baseline gap-2'>
            <span className='text-sm text-left text-(--mantine-color-dimmed) font-bold shrink-0'>{label}</span>
            {details && <span className='text-xs text-(--mantine-color-dimmed) truncate'>{details}</span>}
            {popover && (
              <Popover position='bottom' withArrow shadow='md'>
                <Popover.Target>
                  <Button variant='transparent' size='compact-xs'>
                    <FontAwesomeIcon size='lg' icon={popoverIcon} />
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>{popover}</Popover.Dropdown>
              </Popover>
            )}
          </div>
          <span
            className='text-lg font-bold max-w-full'
            style={valueColor ? { color: `var(--mantine-color-${valueColor}-text)` } : undefined}
          >
            {copyOnClick ? (
              <ScrollingText>
                <CopyOnClick content={value} className='text-left block'>
                  {displayValue} {limit && <span className='text-sm text-(--mantine-color-dimmed)'>/ {limit}</span>}
                </CopyOnClick>
              </ScrollingText>
            ) : (
              <ScrollingText>
                {displayValue} {limit && <span className='text-sm text-(--mantine-color-dimmed)'>/ {limit}</span>}
              </ScrollingText>
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
