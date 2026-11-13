import { z } from 'zod';
import updateWebauthnSettings from '@/api/admin/settings/updateWebauthnSettings.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { hasAvailableTwoFactorMethod } from '@/lib/auth/twoFactor.ts';
import { isIP } from '@/lib/network/ip.ts';
import { adminSettingsWebauthnSchema } from '@/lib/schemas/admin/settings.ts';
import { useFormDraft } from '@/plugins/form/useFormDraft.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import { useWebauthnFormFields, webauthnEmptyFormValues, webauthnToFormValues } from './webauthnFormValues.tsx';

type WebauthnFormValues = z.infer<typeof adminSettingsWebauthnSchema>;

export default function WebauthnContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const webauthn = useAdminStore((state) => state.webauthn);
  const app = useAdminStore((state) => state.app);
  const mailMode = useAdminStore((state) => state.mailMode);

  const form = useFormEngine<WebauthnFormValues>('admin.settings.webauthn', {
    schema: adminSettingsWebauthnSchema,
    initialValues: webauthnEmptyFormValues,
  });

  useHydrateForm(form, webauthn, webauthnToFormValues);
  useFormDraft(form, 'webauthn');

  const { loading, submit, confirmOpened, closeConfirm, confirmSave } = useSettingsSection({
    form,
    schema: adminSettingsWebauthnSchema,
    storeKey: 'webauthn',
    update: updateWebauthnSettings,
    successMessage: t('pages.admin.settings.tabs.webauthn.page.toast.updated', {}),
    syncGlobalKey: 'webauthn',
    confirmBeforeSave: (values) => values.rpId !== webauthn.rpId,
  });

  const doAutofill = () => {
    if (isIP(window.location.hostname)) {
      addToast(t('pages.admin.settings.tabs.webauthn.page.toast.ipNotAllowed', {}), 'error');
      return;
    }
    form.setValues({
      rpId: window.location.hostname.split('.').slice(-2).join('.'),
      rpOrigin: window.location.origin,
    });
  };

  const twoFactorLockedOn =
    form.values.enabled &&
    !hasAvailableTwoFactorMethod(app.twoFactorAcceptedMethods, {
      webauthnEnabled: false,
      emailTwoFactorEnabled: app.emailTwoFactorEnabled,
      mailConfigured: mailMode.type !== 'none',
    });

  const fields = useWebauthnFormFields({ disableLocked: twoFactorLockedOn });

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.webauthn.page.title', {})} titleOrder={2}>
      <ConfirmationModal
        opened={confirmOpened}
        onClose={closeConfirm}
        title={t('pages.admin.settings.tabs.webauthn.page.modal.changeRpId.title', {})}
        confirm={t('common.button.update', {})}
        onConfirmed={confirmSave}
      >
        {t('pages.admin.settings.tabs.webauthn.page.modal.changeRpId.content', {})}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(submit)}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <SettingsSaveButton loading={loading} disabled={!form.isValid()} />
          <Button variant='outline' onClick={doAutofill} disabled={loading}>
            {t('pages.admin.settings.tabs.webauthn.page.button.autofill', {})}
          </Button>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
