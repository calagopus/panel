import { faSliders } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { MantineColor, Progress } from '@mantine/core';
import { ReactNode } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Text from '@/elements/typography/Text.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface AllocationSegment {
  key: string;
  label: string;
  value: number;
  color: MantineColor;
  to?: string;
  striped?: boolean;
  hint?: string;
}

const allocationTotalModes = ['limit', 'live', 'aggregate', 'custom'] as const;

export const allocationTotalSchema = z.object({
  mode: z.enum(allocationTotalModes),
  custom: z.number().min(0),
});

export const allocationTotalsSchema = z.object({
  memory: allocationTotalSchema.optional(),
  disk: allocationTotalSchema.optional(),
  cpu: allocationTotalSchema.optional(),
});

export type AllocationTotal = z.infer<typeof allocationTotalSchema>;

export const noAllocationTotals: z.infer<typeof allocationTotalsSchema> = {};

const SEGMENT_COLORS: MantineColor[] = [
  'blue.7',
  'teal.7',
  'violet.7',
  'orange.7',
  'cyan.7',
  'green.7',
  'pink.7',
  'indigo.7',
  'yellow.7',
  'lime.7',
];

export function groupAllocationSegments<T>(
  items: T[],
  value: (item: T) => number,
  toSegment: (item: T) => Omit<AllocationSegment, 'value' | 'color'>,
  otherLabel: (count: number) => string,
): AllocationSegment[] {
  const sorted = items.filter((item) => value(item) > 0).sort((a, b) => value(b) - value(a));
  const shown = sorted.length > SEGMENT_COLORS.length ? sorted.slice(0, SEGMENT_COLORS.length - 1) : sorted;
  const rest = sorted.slice(shown.length);

  const segments: AllocationSegment[] = shown.map((item, i) => ({
    ...toSegment(item),
    value: value(item),
    color: SEGMENT_COLORS[i],
  }));

  if (rest.length > 0) {
    segments.push({
      key: 'other',
      label: otherLabel(rest.length),
      value: rest.reduce((sum, item) => sum + value(item), 0),
      color: 'gray.6',
    });
  }

  return segments;
}

export default function AllocationBar({
  label,
  icon,
  segments,
  limit: configuredLimit,
  formatValue,
  details,
  emptyLabel,
  overallocatedLabel,
  totalSource,
}: {
  label: string;
  icon: ReactNode;
  segments: AllocationSegment[];
  limit: number;
  formatValue: (value: number) => string;
  details?: ReactNode;
  emptyLabel: ReactNode;
  overallocatedLabel: (excess: string) => ReactNode;
  totalSource?: {
    unit: 'mb' | 'percent';
    value?: AllocationTotal;
    onChange: (value: AllocationTotal) => void;
    liveTotal?: number | null;
  };
}) {
  const { t } = useTranslations();

  const defaultMode = totalSource?.unit === 'percent' ? 'aggregate' : 'limit';
  const modes = allocationTotalModes.filter((mode) => totalSource?.unit !== 'percent' || mode !== 'limit');
  const selected = totalSource?.value ?? { mode: defaultMode, custom: 0 };
  const mode = selected.mode === 'live' && totalSource?.liveTotal == null ? defaultMode : selected.mode;

  const limit = (() => {
    switch (mode) {
      case 'live':
        return totalSource?.liveTotal ?? configuredLimit;
      case 'aggregate':
        return 0;
      case 'custom':
        return selected.custom;
      default:
        return configuredLimit;
    }
  })();

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const scale = Math.max(limit, total);
  const share = (value: number) => (scale > 0 ? (value / scale) * 100 : 0);
  const overallocated = limit > 0 && total > limit;

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
        <Text fw={500}>
          {icon} {label}
        </Text>
        <div className='flex flex-row items-center gap-1'>
          <Text size='sm' c={overallocated ? 'red' : 'dimmed'}>
            {limit > 0 ? `${formatValue(total)} / ${formatValue(limit)}` : formatValue(total)}
            {mode !== defaultMode && ` (${t(`elements.allocationBar.total.${mode}`, {})})`}
          </Text>
          {totalSource && (
            <Popover position='bottom-end' withArrow shadow='md'>
              <Popover.Target>
                <Tooltip label={t('elements.allocationBar.tooltip.total', {})}>
                  <ActionIcon variant='subtle' color='gray' size='sm'>
                    <FontAwesomeIcon icon={faSliders} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown>
                <div className='flex flex-col gap-2 w-64'>
                  <Select
                    label={t('elements.allocationBar.form.total', {})}
                    data={modes.map((mode) => ({
                      value: mode,
                      label: t(`elements.allocationBar.total.${mode}`, {}),
                    }))}
                    value={selected.mode}
                    onChange={(mode) => totalSource.onChange({ ...selected, mode: mode as AllocationTotal['mode'] })}
                    comboboxProps={{ withinPortal: false }}
                  />
                  {selected.mode === 'custom' &&
                    (totalSource.unit === 'percent' ? (
                      <NumberInput
                        label={t('elements.allocationBar.form.customTotal', {})}
                        suffix='%'
                        min={0}
                        allowDecimal={false}
                        value={selected.custom}
                        onChange={(custom) => totalSource.onChange({ ...selected, custom: Number(custom) || 0 })}
                      />
                    ) : (
                      <SizeInput
                        label={t('elements.allocationBar.form.customTotal', {})}
                        mode='mb'
                        min={0}
                        value={selected.custom}
                        onChange={(custom) => totalSource.onChange({ ...selected, custom })}
                      />
                    ))}
                </div>
              </Popover.Dropdown>
            </Popover>
          )}
        </div>
      </div>

      {total === 0 ? (
        <Text size='sm' c='dimmed'>
          {emptyLabel}
        </Text>
      ) : (
        <>
          <div className='relative'>
            <Progress.Root size='xl'>
              {segments.map((segment) => (
                <Tooltip
                  unwrapped
                  key={segment.key}
                  label={`${segment.label}: ${formatValue(segment.value)}${segment.hint ? ` (${segment.hint})` : ''}`}
                >
                  <Progress.Section
                    value={share(segment.value)}
                    color={segment.color}
                    striped={segment.striped}
                    className='border-r border-(--mantine-color-body) last:border-r-0'
                  />
                </Tooltip>
              ))}
            </Progress.Root>
            {overallocated && (
              <div
                className='absolute -top-1 -bottom-1 w-0.5 bg-(--mantine-color-red-filled)'
                style={{ left: `${share(limit)}%` }}
              />
            )}
          </div>

          <div className='flex flex-row flex-wrap gap-x-4 gap-y-1'>
            {segments.map((segment) => (
              <div key={segment.key} className='flex flex-row items-center gap-1.5 text-xs'>
                <span
                  className='inline-block size-2.5 rounded-full shrink-0'
                  style={{ backgroundColor: `var(--mantine-color-${segment.color.replace('.', '-')})` }}
                />
                {segment.to ? <TableLink to={segment.to}>{segment.label}</TableLink> : <span>{segment.label}</span>}
                <span className='text-(--mantine-color-dimmed) tabular-nums'>
                  {formatValue(segment.value)} · {((segment.value / (limit > 0 ? limit : total)) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {overallocated && (
        <Text size='xs' c='red'>
          {overallocatedLabel(formatValue(total - limit))}
        </Text>
      )}
      {details}
    </div>
  );
}
