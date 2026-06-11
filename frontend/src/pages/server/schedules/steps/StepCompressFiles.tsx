import { Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import { archiveFormatLabelMapping } from '@/lib/enums.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../ScheduleDynamicParameterInput.tsx';

export default function StepCompressFiles({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('pages.server.schedules.form.rootPath', {})}
        placeholder={t('pages.server.schedules.form.rootPath', {})}
        value={form.getInputProps('action.root').value}
        onChange={(v) => form.setFieldValue('action.root', v)}
      />
      <TagsInput
        withAsterisk
        label={t('pages.server.schedules.steps.compressFiles.form.filesToCompress', {})}
        placeholder={t('pages.server.schedules.steps.compressFiles.form.filesToCompress', {})}
        {...form.getInputProps('action.files')}
      />
      <Select
        withAsterisk
        label={t('common.form.archiveFormat', {})}
        data={Object.entries(archiveFormatLabelMapping).map(([value, label]) => ({
          value,
          label,
        }))}
        {...form.getInputProps('action.format')}
      />
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('common.form.archiveName', {})}
        placeholder={t('common.form.archiveName', {})}
        value={form.getInputProps('action.name').value}
        onChange={(v) => form.setFieldValue('action.name', v)}
      />
      <Switch
        label={t('pages.server.schedules.form.runInForeground', {})}
        {...form.getInputProps('action.foreground', { type: 'checkbox' })}
      />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
