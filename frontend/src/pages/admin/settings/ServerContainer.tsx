import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateServerSettings from '@/api/admin/settings/updateServerSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsServerSchema } from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function ServerContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const server = useAdminStore((state) => state.server);
  const updateAdminSettings = useAdminStore((state) => state.updateSettings);
  const updateSettings = useGlobalStore((state) => state.updateSettings);

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminSettingsServerSchema>>({
    initialValues: {
      maxFileManagerViewSize: 0,
      maxFileManagerContentSearchSize: 0,
      maxFileManagerSearchResults: 1,
      maxSubuserCount: 0,
      maxScheduleStepCount: 0,
      allowOverwritingCustomDockerImage: false,
      allowEditingStartupCommand: false,
      allowViewingInstallationLogs: false,
      allowAcknowledgingInstallationFailure: true,
      allowViewingTransferProgress: false,
      containerPrelude: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsServerSchema),
  });

  useEffect(() => {
    form.setValues({
      ...server,
    });
  }, [server]);

  const doUpdate = () => {
    setLoading(true);

    updateServerSettings(adminSettingsServerSchema.parse(form.getValues()))
      .then(() => {
        addToast(t('pages.admin.settings.tabs.server.page.toast.updated', {}), 'success');
        updateSettings({ server: { ...form.getValues() } });
        updateAdminSettings({ server: adminSettingsServerSchema.parse(form.getValues()) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.server.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <SizeInput
            withAsterisk
            label={t('pages.admin.settings.tabs.server.page.form.maxFileManagerViewSize', {})}
            mode='b'
            min={0}
            value={form.getValues().maxFileManagerViewSize}
            onChange={(v) => form.setFieldValue('maxFileManagerViewSize', v)}
          />

          <NumberInput
            withAsterisk
            label={t('pages.admin.settings.tabs.server.page.form.maxScheduleStepCount', {})}
            key={form.key('maxScheduleStepCount')}
            {...form.getInputProps('maxScheduleStepCount')}
          />

          <SizeInput
            withAsterisk
            label={t('pages.admin.settings.tabs.server.page.form.maxFileManagerContentSearchSize', {})}
            mode='b'
            min={0}
            value={form.getValues().maxFileManagerContentSearchSize}
            onChange={(v) => form.setFieldValue('maxFileManagerContentSearchSize', v)}
          />

          <NumberInput
            withAsterisk
            label={t('pages.admin.settings.tabs.server.page.form.maxFileManagerSearchResults', {})}
            key={form.key('maxFileManagerSearchResults')}
            {...form.getInputProps('maxFileManagerSearchResults')}
          />

          <NumberInput
            withAsterisk
            label={t('pages.admin.settings.tabs.server.page.form.maxSubuserCount', {})}
            key={form.key('maxSubuserCount')}
            {...form.getInputProps('maxSubuserCount')}
          />

          <Switch
            label={t('pages.admin.settings.tabs.server.page.form.allowOverwritingCustomDockerImage', {})}
            description={t(
              'pages.admin.settings.tabs.server.page.form.allowOverwritingCustomDockerImageDescription',
              {},
            )}
            key={form.key('allowOverwritingCustomDockerImage')}
            {...form.getInputProps('allowOverwritingCustomDockerImage', { type: 'checkbox' })}
          />

          <Switch
            label={t('pages.admin.settings.tabs.server.page.form.allowViewingInstallationLogs', {})}
            description={t('pages.admin.settings.tabs.server.page.form.allowViewingInstallationLogsDescription', {})}
            key={form.key('allowViewingInstallationLogs')}
            {...form.getInputProps('allowViewingInstallationLogs', { type: 'checkbox' })}
          />

          <Switch
            label={t('pages.admin.settings.tabs.server.page.form.allowAcknowledgingInstallationFailure', {})}
            description={t(
              'pages.admin.settings.tabs.server.page.form.allowAcknowledgingInstallationFailureDescription',
              {},
            )}
            key={form.key('allowAcknowledgingInstallationFailure')}
            {...form.getInputProps('allowAcknowledgingInstallationFailure', { type: 'checkbox' })}
          />

          <Switch
            label={t('pages.admin.settings.tabs.server.page.form.allowViewingTransferProgress', {})}
            description={t('pages.admin.settings.tabs.server.page.form.allowViewingTransferProgressDescription', {})}
            key={form.key('allowViewingTransferProgress')}
            {...form.getInputProps('allowViewingTransferProgress', { type: 'checkbox' })}
          />

          <TextInput
            withAsterisk
            label={t('pages.admin.settings.tabs.server.page.form.containerPrelude', {})}
            description={t('pages.admin.settings.tabs.server.page.form.containerPreludeDescription', {})}
            key={form.key('containerPrelude')}
            {...form.getInputProps('containerPrelude')}
          />
        </div>

        <Group mt='md'>
          <AdminCan action='settings.update' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
