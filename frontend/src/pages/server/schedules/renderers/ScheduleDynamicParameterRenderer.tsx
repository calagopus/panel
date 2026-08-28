import { z } from 'zod';
import Badge from '@/elements/Badge.tsx';
import Code from '@/elements/Code.tsx';
import { serverScheduleStepDynamicSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ScheduleDynamicParameterRendererProps {
  value: z.infer<typeof serverScheduleStepDynamicSchema> | null;
}

export default function ScheduleDynamicParameterRenderer({ value }: ScheduleDynamicParameterRendererProps) {
  const { t } = useTranslations();

  return value === null ? (
    <Code>{t('elements.scheduleDynamicInput.none', {})}</Code>
  ) : typeof value === 'string' ? (
    <Code>{value}</Code>
  ) : (
    <>
      <Badge size='xs'>{t('elements.scheduleDynamicInput.variable', {})}</Badge>
      <Code>{value.variable}</Code>
    </>
  );
}
