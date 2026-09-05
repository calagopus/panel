import { useState } from 'react';
import { z } from 'zod';
import getAssets from '@/api/admin/assets/getAssets.ts';
import updateApplicationSettings from '@/api/admin/settings/updateApplicationSettings.ts';
import getTelemetry from '@/api/admin/system/getTelemetry.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { AdvancedModeToggle, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { adminSettingsApplicationSchema } from '@/lib/schemas/admin/settings.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import {
  applicationEmptyFormValues,
  applicationToFormValues,
  useApplicationFormFields,
} from './applicationFormValues.tsx';
import TelemetryPreviewModal from './TelemetryPreviewModal.tsx';

type AppFormValues = z.infer<typeof adminSettingsApplicationSchema>;

export default function ApplicationContainer() {
  const { addToast } = useToast();
  const { t, tReact } = useTranslations();
  const app = useAdminStore((state) => state.app);
  const languages = useGlobalStore((state) => state.languages);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [telemetryData, setTelemetryData] = useState<object | null>(null);
  const [openModal, setOpenModal] = useState<'disableTelemetry' | 'enableRegistration' | null>(null);
  const canReadAssets = useAdminCan('assets.read');

  const form = useFormEngine<AppFormValues>('admin.settings.application', {
    schema: adminSettingsApplicationSchema,
    initialValues: applicationEmptyFormValues,
    validateInputOnBlur: true,
  });

  const assets = useSearchableResource<z.infer<typeof storageAssetSchema>>({
    queryKey: queryKeys.admin.assets.all(),
    fetcher: () => getAssets(1, ''),
    canRequest: canReadAssets,
  });

  useHydrateForm(form, app, applicationToFormValues);

  const { loading, submit } = useSettingsSection({
    form,
    schema: adminSettingsApplicationSchema,
    storeKey: 'app',
    update: updateApplicationSettings,
    successMessage: t('pages.admin.settings.tabs.application.page.toast.updated', {}),
    syncGlobalKey: 'app',
  });

  const doPreviewTelemetry = () => {
    setPreviewLoading(true);
    getTelemetry()
      .then((data) => setTelemetryData(data))
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setPreviewLoading(false));
  };

  const fields = useApplicationFormFields({
    languages,
    assetUrls: assets.items.map((a) => a.url),
    onTelemetryToggle: (checked) =>
      checked ? form.setFieldValue('telemetryEnabled', true) : setOpenModal('disableTelemetry'),
    onRegistrationToggle: (checked) =>
      checked ? setOpenModal('enableRegistration') : form.setFieldValue('registrationEnabled', false),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.settings.tabs.application.page.title', {})}
      titleOrder={2}
      contentRight={<AdvancedModeToggle />}
    >
      <TelemetryPreviewModal
        telemetry={telemetryData}
        opened={telemetryData !== null}
        onClose={() => setTelemetryData(null)}
      />
      <ConfirmationModal
        opened={openModal === 'disableTelemetry'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.settings.tabs.application.page.modal.disableTelemetry.title', {})}
        confirm={t('common.button.disable', {})}
        onConfirmed={() => {
          form.setFieldValue('telemetryEnabled', false);
          setOpenModal(null);
        }}
      >
        {tReact('pages.admin.settings.tabs.application.page.modal.disableTelemetry.content', {})}
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'enableRegistration'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.settings.tabs.application.page.modal.enableRegistration.title', {})}
        confirm={t('common.button.enable', {})}
        onConfirmed={() => {
          form.setFieldValue('registrationEnabled', true);
          setOpenModal(null);
        }}
      >
        {tReact('pages.admin.settings.tabs.application.page.modal.enableRegistration.content', {})}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(submit)}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <SettingsSaveButton loading={loading} disabled={!form.isValid()} />
          <AdminCan action='stats.read'>
            <Button variant='outline' loading={previewLoading} onClick={doPreviewTelemetry}>
              {t('pages.admin.settings.tabs.application.page.button.previewTelemetry', {})}
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
