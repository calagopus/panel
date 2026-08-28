import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { serverScheduleStepRenameFilesSchema, serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../forms/ScheduleDynamicParameterInput.tsx';

export default function StepRenameFiles({
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

      <Stack gap='xs'>
        <Text>{t('pages.server.schedules.steps.renameFiles.form.files', {})}</Text>
        {(form.values.action as z.infer<typeof serverScheduleStepRenameFilesSchema>).files.map(
          (file, index: number) => (
            <Group key={index}>
              <TextInput
                withAsterisk
                label={t('pages.server.schedules.steps.renameFiles.form.from', {})}
                placeholder={t('pages.server.schedules.steps.renameFiles.form.from', {})}
                value={file.from}
                {...form.getInputProps(`action.files.${index}.from`)}
              />
              <TextInput
                withAsterisk
                label={t('pages.server.schedules.steps.renameFiles.form.to', {})}
                placeholder={t('pages.server.schedules.steps.renameFiles.form.to', {})}
                value={file.to}
                {...form.getInputProps(`action.files.${index}.to`)}
              />
            </Group>
          ),
        )}
        {form.getInputProps('action.files').error && (
          <Text size='xs' c='red' mt={4}>
            {form.getInputProps('action.files').error}
          </Text>
        )}
      </Stack>

      <Button onClick={() => form.insertListItem('action.files', { from: '', to: '' })}>
        {t('pages.server.schedules.button.addFile', {})}
      </Button>

      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
