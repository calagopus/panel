import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue/i18n';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Text from '@/elements/typography/Text.tsx';
import { isValidCronExpression } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const CRON_SEGMENTS = ['second', 'minute', 'hour', 'day', 'month', 'weekday'] as const;

interface CrontabEditorProps {
  value: string;
  setValue: (value: string) => void;
}

export function CrontabEditor({ value, setValue }: CrontabEditorProps) {
  const { t } = useTranslations();
  const [segments, setSegments] = useState(['0', '*', '*', '*', '*', '*']);

  useEffect(() => {
    const newSegments = value.split(' ');
    if (segments.every((s, i) => newSegments[i] === s)) {
      return;
    }

    for (let i = 0; i < CRON_SEGMENTS.length; i++) {
      if (!newSegments[i]) {
        newSegments[i] = i === 0 ? '0' : '*';
      }
    }

    setSegments(newSegments);
  }, [segments, value]);

  const setSegment = (index: number, value: string) => {
    const newSegments = [...segments.slice(0, index), value, ...segments.slice(index + 1)];
    setSegments(newSegments);

    setValue(newSegments.join(' '));
  };

  return (
    <div className='grid grid-cols-3 gap-2 w-64'>
      {CRON_SEGMENTS.map((segment, i) => (
        <TextInput
          key={segment}
          label={t(`common.elements.cronInput.segments.${segment}`, {})}
          placeholder={t(`common.elements.cronInput.segments.${segment}`, {})}
          value={segments[i]}
          className='flex-1'
          onChange={(e) => setSegment(i, e.target.value)}
        />
      ))}
    </div>
  );
}

interface CronInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: ReactNode;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  placeholder?: string;
  timezone?: string;
}

export default function CronInput({
  value,
  onChange,
  onBlur,
  error,
  label,
  description,
  required,
  placeholder,
  timezone = 'UTC',
}: CronInputProps) {
  const { tReact, language } = useTranslations();

  const cronValid = isValidCronExpression(value);

  const cronDescription = useMemo(() => {
    if (!cronValid) return null;

    try {
      return cronstrue.toString(value, { locale: language });
    } catch {
      return null;
    }
  }, [cronValid, value, language]);

  const nextRun = useMemo(() => {
    if (!cronValid) return null;

    try {
      return CronExpressionParser.parse(value, { tz: timezone }).next().toDate();
    } catch {
      return null;
    }
  }, [cronValid, value, timezone]);

  return (
    <Stack gap={4}>
      <Popover>
        <Popover.Target>
          <TextInput
            label={label}
            description={description}
            withAsterisk={required}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            error={error}
          />
        </Popover.Target>
        <Popover.Dropdown>
          <CrontabEditor value={value} setValue={onChange} />
        </Popover.Dropdown>
      </Popover>

      {(cronDescription || nextRun) && (
        <Text component='div' c='dimmed' size='sm'>
          {cronDescription && `${cronDescription} · `}
          {nextRun &&
            tReact('common.elements.cronInput.nextRun', {
              timestamp: (
                <FormattedTimestamp timestamp={nextRun} autoUpdate={false} precise tooltipClassName='inline-block' />
              ),
            })}
        </Text>
      )}
    </Stack>
  );
}
