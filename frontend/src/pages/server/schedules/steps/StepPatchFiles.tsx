import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { patchFormatLabelMapping } from '@/lib/enums.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../forms/ScheduleDynamicParameterInput.tsx';

export default function StepPatchFiles({
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
        error={form.getInputProps('action.root').error}
        onChange={(v) => form.setFieldValue('action.root', v)}
      />
      <Select
        withAsterisk
        label={t('pages.server.files.modal.patchFile.form.format', {})}
        data={Object.entries(patchFormatLabelMapping).map(([value, label]) => ({
          value,
          label,
        }))}
        {...form.getInputProps('action.format')}
      />
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('pages.server.schedules.steps.patchFiles.form.patch', {})}
        placeholder={t('pages.server.schedules.steps.patchFiles.form.patch', {})}
        value={form.getInputProps('action.patch').value}
        error={form.getInputProps('action.patch').error}
        onChange={(v) => form.setFieldValue('action.patch', v)}
      />
      {form.getInputProps('action.format').value === 'bsdiff' ? (
        <ScheduleDynamicParameterInput
          withAsterisk
          label={t('pages.server.files.modal.patchFile.form.file', {})}
          placeholder={t('pages.server.files.modal.patchFile.form.file', {})}
          value={form.getInputProps('action.file').value}
          error={form.getInputProps('action.file').error}
          onChange={(v) => form.setFieldValue('action.file', v)}
        />
      ) : (
        <NumberInput
          withAsterisk
          label={t('pages.server.files.modal.patchFile.form.strip', {})}
          description={t('pages.server.files.modal.patchFile.form.stripDescription', {})}
          min={0}
          allowDecimal={false}
          {...form.getInputProps('action.strip')}
        />
      )}
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
