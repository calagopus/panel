import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getAssets from '@/api/admin/assets/getAssets.ts';
import updateApplicationSettings from '@/api/admin/settings/updateApplicationSettings.ts';
import getTelemetry from '@/api/admin/system/getTelemetry.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { AdvancedModeToggle, type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { adminSettingsApplicationSchema } from '@/lib/schemas/admin/settings.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import TelemetryPreviewModal from './modals/TelemetryPreviewModal.tsx';

type AppFormValues = z.infer<typeof adminSettingsApplicationSchema>;

export default function ApplicationContainer() {
  const { addToast } = useToast();
  const { t, tReact } = useTranslations();
  const app = useAdminStore((state) => state.app);
  const updateAdminSettings = useAdminStore((state) => state.updateSettings);
  const languages = useGlobalStore((state) => state.languages);
  const settings = useGlobalStore((state) => state.settings);
  const updateSettings = useGlobalStore((state) => state.updateSettings);

  const [loading, setLoading] = useState(false);
  const [telemetryData, setTelemetryData] = useState<object | null>(null);
  const [openModal, setOpenModal] = useState<'disableTelemetry' | 'enableRegistration' | null>(null);
  const canReadAssets = useAdminCan('assets.read');

  const {
    formExtension,
    zodShape,
    initialValues: extInitialValues,
  } = useFormExtensions<AppFormValues>('admin.settings.application');
  const mergedSchema = adminSettingsApplicationSchema.extend(zodShape);

  const form = useForm<AppFormValues>({
    initialValues: {
      name: '',
      icon: '',
      iconLight: null,
      banner: null,
      bannerLight: null,
      url: '',
      language: 'en',
      twoFactorRequirement: 'none',
      sessionCookie: '',
      sessionDurationSeconds: 3600,
      telemetryEnabled: true,
      registrationEnabled: true,
      ...(extInitialValues as Partial<AppFormValues>),
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(mergedSchema),
  });

  const assets = useSearchableResource<z.infer<typeof storageAssetSchema>>({
    queryKey: queryKeys.admin.assets.all(),
    fetcher: () => getAssets(1, ''),
    canRequest: canReadAssets,
  });

  useEffect(() => {
    form.setValues({ ...app });
  }, [app]);

  const doUpdate = () => {
    setLoading(true);
    updateApplicationSettings(adminSettingsApplicationSchema.parse(form.getValues()))
      .then(() => {
        addToast(t('pages.admin.settings.tabs.application.page.toast.updated', {}), 'success');
        updateSettings({ app: { ...settings.app, ...form.getValues() } });
        updateAdminSettings({ app: adminSettingsApplicationSchema.parse(form.getValues()) });
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  const doPreviewTelemetry = () => {
    setLoading(true);
    getTelemetry()
      .then((data) => setTelemetryData(data))
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  const assetUrls = assets.items.map((a) => a.url);

  const fields: FieldDef<AppFormValues>[] = [
    {
      type: 'text',
      name: 'name',
      label: t('common.form.name', {}),
      required: true,
    },
    {
      type: 'select',
      name: 'language',
      label: t('common.form.language', {}),
      required: true,
      options: languages.map((l) => ({
        label: new Intl.DisplayNames([l], { type: 'language' }).of(l) ?? l,
        value: l,
      })),
      props: { searchable: true },
    },
    {
      type: 'autocomplete',
      name: 'icon',
      label: t('pages.admin.settings.tabs.application.page.form.icon', {}),
      required: true,
      options: assetUrls,
    },
    {
      type: 'autocomplete',
      name: 'iconLight',
      label: t('pages.admin.settings.tabs.application.page.form.iconLight', {}),
      options: assetUrls,
      advanced: true,
    },
    {
      type: 'autocomplete',
      name: 'banner',
      label: t('pages.admin.settings.tabs.application.page.form.banner', {}),
      options: assetUrls,
    },
    {
      type: 'autocomplete',
      name: 'bannerLight',
      label: t('pages.admin.settings.tabs.application.page.form.bannerLight', {}),
      options: assetUrls,
      advanced: true,
    },
    {
      type: 'text',
      name: 'url',
      label: t('common.form.url', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'sessionCookie',
      label: t('pages.admin.settings.tabs.application.page.form.sessionCookie', {}),
      required: true,
      advanced: true,
    },
    {
      type: 'number',
      name: 'sessionDurationSeconds',
      label: t('pages.admin.settings.tabs.application.page.form.sessionDurationSeconds', {}),
      required: true,
      advanced: true,
    },
    {
      type: 'select',
      name: 'twoFactorRequirement',
      label: t('pages.admin.settings.tabs.application.page.form.twoFactorRequirement', {}),
      required: true,
      options: [
        {
          label: t('pages.admin.settings.tabs.application.page.enum.twoFactorRequirement.admins', {}),
          value: 'admins',
        },
        {
          label: t('pages.admin.settings.tabs.application.page.enum.twoFactorRequirement.allUsers', {}),
          value: 'all_users',
        },
        {
          label: t('pages.admin.settings.tabs.application.page.enum.twoFactorRequirement.none', {}),
          value: 'none',
        },
      ],
    },
    {
      type: 'switch',
      name: 'telemetryEnabled',
      label: t('pages.admin.settings.tabs.application.page.form.telemetryEnabled', {}),
      description: t('pages.admin.settings.tabs.application.page.form.telemetryEnabledDescription', {}),
      props: {
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          if (!e.target.checked) {
            setOpenModal('disableTelemetry');
          } else {
            form.setFieldValue('telemetryEnabled', true);
          }
        },
      },
    },
    {
      type: 'switch',
      name: 'registrationEnabled',
      label: t('pages.admin.settings.tabs.application.page.form.registrationEnabled', {}),
      props: {
        name: 'registrationEnabled',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          if (e.target.checked) {
            setOpenModal('enableRegistration');
          } else {
            form.setFieldValue('registrationEnabled', false);
          }
        },
      },
    },
  ];

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

      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <FormEngine form={form} fields={fields} extensions={[formExtension]} />

        <Group mt='md'>
          <AdminCan action='settings.update' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
          </AdminCan>
          <AdminCan action='stats.read'>
            <Button variant='outline' loading={loading} onClick={doPreviewTelemetry}>
              {t('pages.admin.settings.tabs.application.page.button.previewTelemetry', {})}
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
