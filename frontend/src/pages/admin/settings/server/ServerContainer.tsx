import { z } from 'zod';
import updateServerSettings from '@/api/admin/settings/updateServerSettings.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import { adminSettingsServerSchema } from '@/lib/schemas/admin/settings.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import {
  serverSettingsEmptyFormValues,
  serverSettingsToFormValues,
  useServerSettingsFormFields,
} from './serverSettingsFormValues.tsx';

type ServerFormValues = z.infer<typeof adminSettingsServerSchema>;

export default function ServerContainer() {
  const { t } = useTranslations();
  const server = useAdminStore((state) => state.server);

  const form = useFormEngine<ServerFormValues>('admin.settings.server', {
    schema: adminSettingsServerSchema,
    initialValues: serverSettingsEmptyFormValues,
    validateInputOnBlur: true,
  });

  useHydrateForm(form, server, serverSettingsToFormValues);

  const { loading, submit } = useSettingsSection({
    form,
    schema: adminSettingsServerSchema,
    storeKey: 'server',
    update: updateServerSettings,
    successMessage: t('pages.admin.settings.tabs.server.page.toast.updated', {}),
    syncGlobalKey: 'server',
  });

  const fields = useServerSettingsFormFields();

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.server.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(submit)}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <SettingsSaveButton loading={loading} disabled={!form.isValid()} />
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
