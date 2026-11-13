import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import updateEmailSettings from '@/api/admin/settings/updateEmailSettings.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Select from '@/elements/input/Select.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { mailModeTypeLabelMapping, mappingToSelectData } from '@/lib/enums.ts';
import { adminSettingsEmailSchema } from '@/lib/schemas/admin/settings.ts';
import { liveValidation } from '@/plugins/form/liveValidation.ts';
import { useFormDraft } from '@/plugins/form/useFormDraft.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import DiscriminatedSettingsForm from '../DiscriminatedSettingsForm.tsx';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import { emailEmptyFormValues, emailToFormValues, useEmailModeVariants } from './emailFormValues.tsx';
import EmailSendTestModal from './EmailSendTestModal.tsx';

type EmailValues = z.infer<typeof adminSettingsEmailSchema>;

export default function EmailContainer() {
  const { t, tReact } = useTranslations();
  const mailMode = useAdminStore((state) => state.mailMode);
  const mailInUse = useAdminStore((state) => state.app.emailTwoFactorEnabled || state.app.emailVerificationRequired);

  const [testModalOpen, setTestModalOpen] = useState(false);

  const form = useForm<EmailValues>({
    initialValues: emailEmptyFormValues,
    ...liveValidation,
    validate: zod4Resolver(adminSettingsEmailSchema),
  });

  useHydrateForm(form, mailMode, emailToFormValues);
  useFormDraft(form, 'mail');

  const { loading, submit } = useSettingsSection({
    form,
    schema: adminSettingsEmailSchema,
    storeKey: 'mailMode',
    update: updateEmailSettings,
    successMessage: t('pages.admin.settings.tabs.mail.page.toast.updated', {}),
  });

  const variants = useEmailModeVariants();
  const noneBlocked = mailInUse && form.values.type === 'none';

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.mail.page.title', {})} titleOrder={2}>
      <EmailSendTestModal opened={testModalOpen} onClose={() => setTestModalOpen(false)} />

      <form
        onSubmit={form.onSubmit(() => {
          if (!noneBlocked) submit();
        })}
      >
        {noneBlocked && (
          <Alert color='red' mb='md' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
            {tReact('pages.admin.settings.tabs.mail.page.alert.noneInUse', {
              link: (
                <Link to='/admin/settings' className='text-(--mantine-color-anchor) hover:underline'>
                  {t('pages.admin.settings.tabs.mail.page.alert.noneInUseLink', {})}
                </Link>
              ),
            })}
          </Alert>
        )}
        <Select
          label={t('common.form.provider', {})}
          data={mappingToSelectData(mailModeTypeLabelMapping)}
          key={form.key('type')}
          {...form.getInputProps('type')}
        />

        <DiscriminatedSettingsForm form={form} discriminant='type' variants={variants} />

        <Group mt='md'>
          <SettingsSaveButton loading={loading} disabled={!form.isValid() || noneBlocked} />
          <AdminCan action='settings.read'>
            <ConditionalTooltip
              enabled={mailMode.type === 'none'}
              label={t('pages.admin.settings.tabs.mail.page.tooltip.noProvider', {})}
            >
              <Button
                variant='outline'
                loading={loading}
                disabled={mailMode.type === 'none'}
                onClick={() => setTestModalOpen(true)}
              >
                {t('common.button.sendTestEmail', {})}
              </Button>
            </ConditionalTooltip>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
