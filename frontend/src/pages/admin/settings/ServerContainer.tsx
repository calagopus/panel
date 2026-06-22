import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateServerSettings from '@/api/admin/settings/updateServerSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import { adminSettingsServerSchema } from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type ServerFormValues = z.infer<typeof adminSettingsServerSchema>;

export default function ServerContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const { server, updateSettings: updateAdminSettings } = useAdminStore();
  const { updateSettings } = useGlobalStore();

  const [loading, setLoading] = useState(false);

  const form = useForm<ServerFormValues>({
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
    form.setValues({ ...server });
  }, [server]);

  const doUpdate = () => {
    setLoading(true);
    updateServerSettings(adminSettingsServerSchema.parse(form.getValues()))
      .then(() => {
        addToast(t('pages.admin.settings.tabs.server.page.toast.updated', {}), 'success');
        updateSettings({ server: { ...form.getValues() } });
        updateAdminSettings({ server: adminSettingsServerSchema.parse(form.getValues()) });
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  const fields: FieldDef<ServerFormValues>[] = [
    {
      type: 'custom',
      name: 'maxFileManagerViewSize',
      render: (f) => (
        <SizeInput
          withAsterisk
          label={t('pages.admin.settings.tabs.server.page.form.maxFileManagerViewSize', {})}
          mode='b'
          min={0}
          value={f.getValues().maxFileManagerViewSize}
          onChange={(v) => f.setFieldValue('maxFileManagerViewSize', v)}
        />
      ),
    },
    {
      type: 'number',
      name: 'maxScheduleStepCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxScheduleStepCount', {}),
      required: true,
    },
    {
      type: 'custom',
      name: 'maxFileManagerContentSearchSize',
      render: (f) => (
        <SizeInput
          withAsterisk
          label={t('pages.admin.settings.tabs.server.page.form.maxFileManagerContentSearchSize', {})}
          mode='b'
          min={0}
          value={f.getValues().maxFileManagerContentSearchSize}
          onChange={(v) => f.setFieldValue('maxFileManagerContentSearchSize', v)}
        />
      ),
    },
    {
      type: 'number',
      name: 'maxFileManagerSearchResults',
      label: t('pages.admin.settings.tabs.server.page.form.maxFileManagerSearchResults', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxSubuserCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxSubuserCount', {}),
      required: true,
    },
    {
      type: 'switch',
      name: 'allowOverwritingCustomDockerImage',
      label: t('pages.admin.settings.tabs.server.page.form.allowOverwritingCustomDockerImage', {}),
      description: t('pages.admin.settings.tabs.server.page.form.allowOverwritingCustomDockerImageDescription', {}),
    },
    {
      type: 'switch',
      name: 'allowViewingInstallationLogs',
      label: t('pages.admin.settings.tabs.server.page.form.allowViewingInstallationLogs', {}),
      description: t('pages.admin.settings.tabs.server.page.form.allowViewingInstallationLogsDescription', {}),
    },
    {
      type: 'switch',
      name: 'allowAcknowledgingInstallationFailure',
      label: t('pages.admin.settings.tabs.server.page.form.allowAcknowledgingInstallationFailure', {}),
      description: t('pages.admin.settings.tabs.server.page.form.allowAcknowledgingInstallationFailureDescription', {}),
    },
    {
      type: 'switch',
      name: 'allowViewingTransferProgress',
      label: t('pages.admin.settings.tabs.server.page.form.allowViewingTransferProgress', {}),
      description: t('pages.admin.settings.tabs.server.page.form.allowViewingTransferProgressDescription', {}),
    },
    {
      type: 'text',
      name: 'containerPrelude',
      label: t('pages.admin.settings.tabs.server.page.form.containerPrelude', {}),
      description: t('pages.admin.settings.tabs.server.page.form.containerPreludeDescription', {}),
      required: true,
    },
  ];

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.server.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <FormEngine form={form} fields={fields} />

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
