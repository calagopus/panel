import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../ScheduleDynamicParameterInput.tsx';

export default function StepWriteFile({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('common.form.filePath', {})}
        placeholder={t('common.form.filePath', {})}
        value={form.getInputProps('action.file').value}
        onChange={(v) => form.setFieldValue('action.file', v)}
      />
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('pages.server.schedules.steps.writeFile.form.content', {})}
        placeholder={t('pages.server.schedules.steps.writeFile.form.content', {})}
        textArea
        value={form.getInputProps('action.content').value}
        onChange={(v) => form.setFieldValue('action.content', v)}
      />
      <Group>
        <Switch
          label={t('pages.server.schedules.steps.writeFile.form.appendToFile', {})}
          {...form.getInputProps('action.append', { type: 'checkbox' })}
        />
        <Switch
          label={t('pages.server.schedules.form.ignoreFailure', {})}
          {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
        />
      </Group>
    </Stack>
  );
}
