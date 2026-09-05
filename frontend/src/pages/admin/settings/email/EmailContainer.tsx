import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import updateEmailSettings from '@/api/admin/settings/updateEmailSettings.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import Group from '@/elements/layout/Group.tsx';
import { mailModeTypeLabelMapping, mappingToSelectData } from '@/lib/enums.ts';
import { adminSettingsEmailSchema } from '@/lib/schemas/admin/settings.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import DiscriminatedSettingsForm from '../DiscriminatedSettingsForm.tsx';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import EmailSendTestModal from './EmailSendTestModal.tsx';
import { emailEmptyFormValues, emailToFormValues, useEmailModeVariants } from './emailFormValues.tsx';

type EmailValues = z.infer<typeof adminSettingsEmailSchema>;

export default function EmailContainer() {
  const { t } = useTranslations();
  const mailMode = useAdminStore((state) => state.mailMode);

  const [testModalOpen, setTestModalOpen] = useState(false);

  const form = useForm<EmailValues>({
    initialValues: emailEmptyFormValues,
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsEmailSchema),
  });

  useHydrateForm(form, mailMode, emailToFormValues);

  const { loading, submit } = useSettingsSection({
    form,
    schema: adminSettingsEmailSchema,
    storeKey: 'mailMode',
    update: updateEmailSettings,
    successMessage: t('pages.admin.settings.tabs.mail.page.toast.updated', {}),
  });

  const variants = useEmailModeVariants();

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.mail.page.title', {})} titleOrder={2}>
      <EmailSendTestModal opened={testModalOpen} onClose={() => setTestModalOpen(false)} />

      <form onSubmit={form.onSubmit(submit)}>
        <Select
          label={t('common.form.provider', {})}
          data={mappingToSelectData(mailModeTypeLabelMapping)}
          key={form.key('type')}
          {...form.getInputProps('type')}
        />

        <DiscriminatedSettingsForm form={form} discriminant='type' variants={variants} />

        <Group mt='md'>
          <SettingsSaveButton loading={loading} disabled={!form.isValid()} />
          <AdminCan action='settings.read'>
            <Button variant='outline' loading={loading} onClick={() => setTestModalOpen(true)}>
              {t('common.button.sendTestEmail', {})}
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
