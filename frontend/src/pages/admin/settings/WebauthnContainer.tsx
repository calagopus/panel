import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateWebauthnSettings from '@/api/admin/settings/updateWebauthnSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { isIP } from '@/lib/ip.ts';
import { adminSettingsWebauthnSchema } from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

type WebauthnFormValues = z.infer<typeof adminSettingsWebauthnSchema>;

export default function WebauthnContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const { webauthn, updateSettings } = useAdminStore();

  const [openModal, setOpenModal] = useState<'changeRpId' | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    formExtension,
    zodShape,
    initialValues: extInitialValues,
  } = useFormExtensions<WebauthnFormValues>('admin.settings.webauthn');
  const mergedSchema = adminSettingsWebauthnSchema.extend(zodShape);

  const form = useForm<WebauthnFormValues>({
    initialValues: {
      rpId: '',
      rpOrigin: '',
      ...(extInitialValues as Partial<WebauthnFormValues>),
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(mergedSchema),
  });

  useEffect(() => {
    form.setValues({ ...webauthn });
  }, [webauthn]);

  const doUpdate = () => {
    setLoading(true);
    updateWebauthnSettings(adminSettingsWebauthnSchema.parse(form.getValues()))
      .then(() => {
        addToast(t('pages.admin.settings.tabs.webauthn.page.toast.updated', {}), 'success');
        updateSettings({ webauthn: adminSettingsWebauthnSchema.parse(form.getValues()) });
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

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

  const fields: FieldDef<WebauthnFormValues>[] = [
    {
      type: 'text',
      name: 'rpId',
      label: t('pages.admin.settings.tabs.webauthn.page.form.rpId', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'rpOrigin',
      label: t('pages.admin.settings.tabs.webauthn.page.form.rpOrigin', {}),
      required: true,
    },
  ];

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.webauthn.page.title', {})} titleOrder={2}>
      <ConfirmationModal
        opened={openModal === 'changeRpId'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.settings.tabs.webauthn.page.modal.changeRpId.title', {})}
        confirm={t('common.button.update', {})}
        onConfirmed={() => {
          doUpdate();
          setOpenModal(null);
        }}
      >
        {t('pages.admin.settings.tabs.webauthn.page.modal.changeRpId.content', {})}
      </ConfirmationModal>

      <form
        onSubmit={form.onSubmit(() => (form.values.rpId !== webauthn.rpId ? setOpenModal('changeRpId') : doUpdate()))}
      >
        <FormEngine form={form} fields={fields} extensions={[formExtension]} />

        <Group mt='md'>
          <AdminCan action='settings.update' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
          </AdminCan>
          <Button variant='outline' onClick={doAutofill} disabled={loading}>
            {t('pages.admin.settings.tabs.webauthn.page.button.autofill', {})}
          </Button>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
