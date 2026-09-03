import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateActivitySettings from '@/api/admin/settings/updateActivitySettings.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { FormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import { adminSettingsActivitySchema } from '@/lib/schemas/admin/settings.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import { activityEmptyFormValues, activityToFormValues, useActivityFormFields } from './activityFormValues.tsx';

type ActivityValues = z.infer<typeof adminSettingsActivitySchema>;

export default function ActivityContainer() {
  const { t } = useTranslations();
  const activity = useAdminStore((state) => state.activity);

  const form = useForm<ActivityValues>({
    initialValues: activityEmptyFormValues,
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsActivitySchema),
  });

  useHydrateForm(form, activity, activityToFormValues);

  const { loading, submit } = useSettingsSection({
    form,
    schema: adminSettingsActivitySchema,
    storeKey: 'activity',
    update: updateActivitySettings,
    successMessage: t('pages.admin.settings.tabs.activity.page.toast.updated', {}),
  });

  const fields = useActivityFormFields();

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.activity.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(submit)}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <SettingsSaveButton loading={loading} disabled={!form.isValid()} />
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
