import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../forms/ScheduleDynamicParameterInput.tsx';

export default function StepPullFile({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('pages.server.files.modal.pullFile.form.fileUrl', {})}
        placeholder={t('pages.server.files.modal.pullFile.form.fileUrl', {})}
        value={form.getInputProps('action.url').value}
        error={form.getInputProps('action.url').error}
        onChange={(v) => form.setFieldValue('action.url', v)}
      />
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('pages.server.schedules.form.rootPath', {})}
        placeholder={t('pages.server.schedules.form.rootPath', {})}
        value={form.getInputProps('action.root').value}
        error={form.getInputProps('action.root').error}
        onChange={(v) => form.setFieldValue('action.root', v)}
      />
      <ScheduleDynamicParameterInput
        label={t('common.form.fileName', {})}
        placeholder={t('common.form.fileName', {})}
        allowNull
        value={form.getInputProps('action.fileName').value}
        error={form.getInputProps('action.fileName').error}
        onChange={(v) => form.setFieldValue('action.fileName', v)}
      />
      <Switch
        label={t('pages.server.schedules.steps.pullFile.form.useHeader', {})}
        description={t('pages.server.schedules.steps.pullFile.form.useHeaderDescription', {})}
        {...form.getInputProps('action.useHeader', { type: 'checkbox' })}
      />
      <Group>
        <Switch
          label={t('pages.server.schedules.form.runInForeground', {})}
          {...form.getInputProps('action.foreground', { type: 'checkbox' })}
        />
        <Switch
          label={t('pages.server.schedules.form.ignoreFailure', {})}
          {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
        />
      </Group>
    </Stack>
  );
}
