import { UseFormReturnType } from '@mantine/form';
import { useMemo } from 'react';
import { z } from 'zod';
import IgnoredFilesInput from '@/elements/input/IgnoredFilesInput.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { userTeamPresetUpdateSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useAvailablePermissions } from '@/plugins/useAvailablePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface TeamPresetFieldsProps {
  team: z.infer<typeof userTeamSchema>;
  form: UseFormReturnType<z.infer<typeof userTeamPresetUpdateSchema>>;
}

export default function TeamPresetFields({ team, form }: TeamPresetFieldsProps) {
  const { t } = useTranslations();
  const { availablePermissions } = useAvailablePermissions();

  const own = team.membership?.preset;

  // subuser management stays with each server, and a manager never hands out more than they hold
  const grantablePermissions = useMemo(
    () =>
      Object.entries(availablePermissions.serverPermissions)
        .flatMap(([category, entry]) => Object.keys(entry.permissions).map((permission) => `${category}.${permission}`))
        .filter((permission) => !permission.startsWith('subusers.') && (!own || own.permissions.includes(permission))),
    [availablePermissions.serverPermissions, own],
  );

  const ignoredFilesDescription =
    t('pages.account.teams.tabs.presets.form.ignoredFilesDescription', {}) +
    (own && own.ignoredFiles.length > 0
      ? ` ${t('pages.server.subusers.modal.createSubuser.form.ignoredFilesInherited', {})}`
      : '');

  return (
    <>
      <Group grow align='start'>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        <NumberInput
          withAsterisk
          label={t('pages.account.teams.tabs.presets.form.weight', {})}
          description={
            own
              ? t('pages.account.teams.tabs.presets.form.weightDescriptionLimited', { max: own.weight - 1 })
              : t('pages.account.teams.tabs.presets.form.weightDescription', {})
          }
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          min={0}
          max={own ? own.weight - 1 : 1_000_000}
          allowDecimal={false}
          {...form.getInputProps('weight')}
        />
      </Group>

      <TextArea label={t('common.form.description', {})} rows={2} {...form.getInputProps('description')} />

      <PermissionSelector
        label={t('pages.server.subusers.modal.createSubuser.form.permissions', {})}
        permissionsMapType='serverPermissions'
        permissions={availablePermissions.serverPermissions}
        grantablePermissions={grantablePermissions}
        selectedPermissions={form.values.permissions}
        setSelectedPermissions={(permissions) => form.setFieldValue('permissions', permissions)}
      />

      <IgnoredFilesInput
        label={t('common.form.ignoredFiles', {})}
        description={ignoredFilesDescription}
        value={form.values.ignoredFiles}
        onChange={(value) => form.setFieldValue('ignoredFiles', value)}
      />
    </>
  );
}
