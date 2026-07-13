import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../ScheduleDynamicParameterInput.tsx';

export default function StepRestoreBackup({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  const action = form.values.action;
  if (action.type !== 'restore_backup') {
    return null;
  }

  return (
    <Stack>
      <Select
        withAsterisk
        label={t('pages.server.schedules.steps.restoreBackup.form.backupSelector', {})}
        data={(['latest', 'uuid', 'name'] as const).map((mode) => ({
          value: mode,
          label: t(`pages.server.schedules.steps.restoreBackup.form.selector.${mode}`, {}),
        }))}
        value={action.backup.mode}
        onChange={(mode) => {
          form.setFieldValue(
            'action.backup',
            mode === 'uuid'
              ? { mode: 'uuid', uuid: '' }
              : mode === 'name'
                ? { mode: 'name', name: '' }
                : { mode: 'latest' },
          );
        }}
      />
      {action.backup.mode === 'uuid' ? (
        <ScheduleDynamicParameterInput
          withAsterisk
          label={t('pages.server.schedules.steps.restoreBackup.form.backupUuid', {})}
          placeholder={t('pages.server.schedules.steps.restoreBackup.form.backupUuid', {})}
          value={action.backup.uuid}
          onChange={(v) => form.setFieldValue('action.backup.uuid', v)}
        />
      ) : action.backup.mode === 'name' ? (
        <ScheduleDynamicParameterInput
          withAsterisk
          label={t('pages.server.schedules.steps.restoreBackup.form.backupName', {})}
          placeholder={t('pages.server.schedules.steps.restoreBackup.form.backupName', {})}
          value={action.backup.name}
          onChange={(v) => form.setFieldValue('action.backup.name', v)}
        />
      ) : null}
      <Group>
        <Switch
          label={t('pages.server.schedules.steps.restoreBackup.form.truncateDirectory', {})}
          {...form.getInputProps('action.truncateDirectory', { type: 'checkbox' })}
        />
        <Switch
          label={t('pages.server.schedules.steps.restoreBackup.form.restoreStartup', {})}
          {...form.getInputProps('action.restoreStartup', { type: 'checkbox' })}
        />
        <Switch
          label={t('pages.server.schedules.form.ignoreFailure', {})}
          {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
        />
      </Group>
      <Text size='xs' c='dimmed'>
        {t('pages.server.schedules.steps.restoreBackup.form.warning', {})}
      </Text>
    </Stack>
  );
}
