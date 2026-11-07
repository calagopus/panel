import { useState } from 'react';
import { z } from 'zod';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bestUnit, formatUnitBytes, mapUnitToLocale, mbToBytes, UNITS, Unit, unitToBytes } from '@/lib/format/size.ts';
import { serverScheduleResourceMetric } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const PERCENT_OF_LIMIT = 'percent_of_limit';
const CPU_PERCENT = 'cpu_percent';

interface ResourceUsageValueInputProps {
  metric: z.infer<typeof serverScheduleResourceMetric>;
  value: number;
  percentage: boolean;
  onChange: (next: { value: number; percentage: boolean }) => void;
}

export default function ResourceUsageValueInput({ metric, value, percentage, onChange }: ResourceUsageValueInputProps) {
  const { t } = useTranslations();
  const limits = useServerStore((state) => state.server.limits);
  const [unit, setUnit] = useState<Unit>(() => bestUnit(value));

  const isCpu = metric === 'cpu';
  const limit = isCpu ? limits.cpu : mbToBytes(metric === 'memory' ? limits.memory : limits.disk);
  const percentUnavailable = !isCpu && limit === 0;

  const toPercentOfLimit = (absolute: number) =>
    limit > 0 ? Math.round((absolute / limit) * 1000) / 10 : isCpu ? absolute : 0;
  const fromPercentOfLimit = (relative: number) => (limit > 0 ? (relative / 100) * limit : isCpu ? relative : 0);

  const handleUnitChange = (next: string | null) => {
    if (!next) return;

    if (next === PERCENT_OF_LIMIT) {
      if (!percentage) onChange({ value: toPercentOfLimit(value), percentage: true });
      return;
    }

    if (isCpu) {
      if (percentage) onChange({ value: Math.round(fromPercentOfLimit(value) * 10) / 10, percentage: false });
      return;
    }

    if (percentage) {
      const bytes = Math.round(fromPercentOfLimit(value));
      setUnit(next as Unit);
      onChange({ value: bytes, percentage: false });
      return;
    }

    setUnit(next as Unit);
    onChange({ value: unitToBytes(next as Unit, formatUnitBytes(unit, value)), percentage: false });
  };

  const hints: Record<string, string> = {
    [CPU_PERCENT]: t('pages.server.schedules.preCondition.cpuPercentHint', {}),
    [PERCENT_OF_LIMIT]: isCpu
      ? t('pages.server.schedules.preCondition.cpuPercentOfLimitHint', {})
      : t('pages.server.schedules.preCondition.percentOfLimitHint', {}),
  };

  const absolute = isCpu || percentage;

  return (
    <NumberInput
      label={t('pages.server.schedules.preCondition.value', {})}
      min={0}
      hideControls
      value={absolute ? value : formatUnitBytes(unit, value)}
      onChange={(v) => {
        const n = Number(v) || 0;
        onChange({ value: absolute ? n : unitToBytes(unit, n), percentage });
      }}
      error={
        percentage && percentUnavailable
          ? t('pages.server.schedules.preCondition.percentNoLimit', {})
          : percentage && value > 100
            ? t('common.form.rule.percentage', {})
            : undefined
      }
      rightSectionWidth={percentage ? 124 : 80}
      rightSection={
        <Select
          data={[
            ...(isCpu
              ? [{ label: '%', value: CPU_PERCENT }]
              : UNITS.map((u) => ({ label: mapUnitToLocale(u), value: u }))),
            {
              label: t('pages.server.schedules.preCondition.percentOfLimit', {}),
              value: PERCENT_OF_LIMIT,
              disabled: percentUnavailable && !percentage,
            },
          ]}
          value={percentage ? PERCENT_OF_LIMIT : isCpu ? CPU_PERCENT : unit}
          onChange={handleUnitChange}
          renderOption={({ option }) =>
            hints[option.value] ? (
              <div className='flex flex-col'>
                <Text size='sm'>{option.label}</Text>
                <Text size='xs' c='dimmed'>
                  {hints[option.value]}
                </Text>
              </div>
            ) : (
              option.label
            )
          }
          comboboxProps={{ width: 260, position: 'bottom-end' }}
          variant='unstyled'
          styles={{
            input: {
              paddingLeft: 8,
              paddingRight: 8,
              textAlign: 'right',
              cursor: 'pointer',
            },
            wrapper: {
              marginTop: 2,
            },
          }}
        />
      }
    />
  );
}
