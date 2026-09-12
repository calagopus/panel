import { z } from 'zod';
import getAssets from '@/api/admin/assets/getAssets.ts';
import updateMetadataSettings from '@/api/admin/settings/updateMetadataSettings.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { adminSettingsMetadataSchema } from '@/lib/schemas/admin/settings.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import { metadataEmptyFormValues, metadataToFormValues, useMetadataFormFields } from './metadataFormValues.tsx';

type MetadataFormValues = z.infer<typeof adminSettingsMetadataSchema>;

export default function MetadataContainer() {
  const { t } = useTranslations();
  const metadata = useAdminStore((state) => state.metadata);
  const app = useAdminStore((state) => state.app);
  const canReadAssets = useAdminCan('assets.read');

  const form = useFormEngine<MetadataFormValues>('admin.settings.metadata', {
    schema: adminSettingsMetadataSchema,
    initialValues: metadataEmptyFormValues,
    validateInputOnBlur: true,
  });

  const assets = useSearchableResource<z.infer<typeof storageAssetSchema>>({
    queryKey: queryKeys.admin.assets.all(),
    fetcher: () => getAssets(1, ''),
    canRequest: canReadAssets,
  });

  useHydrateForm(form, metadata, metadataToFormValues);

  const { loading, submit } = useSettingsSection({
    form,
    schema: adminSettingsMetadataSchema,
    storeKey: 'metadata',
    update: updateMetadataSettings,
    successMessage: t('pages.admin.settings.tabs.metadata.page.toast.updated', {}),
  });

  const defaultDescription = t('pages.admin.settings.tabs.metadata.page.placeholder.description', { name: app.name });
  const defaultOgImage = `${app.url.replace(/\/+$/, '')}/android-chrome-512x512.png`;

  const fields = useMetadataFormFields({
    assetUrls: assets.items.map((a) => a.url),
    descriptionPlaceholder: defaultDescription,
    ogImagePlaceholder: defaultOgImage,
  });

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.metadata.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(submit)}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <SettingsSaveButton loading={loading} disabled={!form.isValid()} />
          <Button
            variant='outline'
            onClick={() => form.setValues({ description: defaultDescription, ogImage: defaultOgImage })}
            disabled={loading}
          >
            {t('pages.admin.settings.tabs.metadata.page.button.autofill', {})}
          </Button>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
