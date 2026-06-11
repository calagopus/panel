import { Group } from '@mantine/core';
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
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
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

export default function ApplicationContainer() {
  const { addToast } = useToast();
  const { t, tReact } = useTranslations();
  const { app, updateSettings: updateAdminSettings } = useAdminStore();
  const { languages, settings, updateSettings } = useGlobalStore();

  const [loading, setLoading] = useState(false);
  const [telemetryData, setTelemetryData] = useState<object | null>(null);
  const [openModal, setOpenModal] = useState<'disableTelemetry' | 'enableRegistration' | null>(null);
  const canReadAssets = useAdminCan('assets.read');

  const form = useForm<z.infer<typeof adminSettingsApplicationSchema>>({
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
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsApplicationSchema),
  });

  const assets = useSearchableResource<z.infer<typeof storageAssetSchema>>({
    queryKey: queryKeys.admin.assets.all(),
    fetcher: () => getAssets(1, ''),
    canRequest: canReadAssets,
  });

  useEffect(() => {
    form.setValues({
      ...app,
    });
  }, [app]);

  const doUpdate = () => {
    setLoading(true);
    updateApplicationSettings(adminSettingsApplicationSchema.parse(form.getValues()))
      .then(() => {
        addToast(t('pages.admin.settings.tabs.application.page.toast.updated', {}), 'success');
        updateSettings({ app: { ...settings.app, ...form.getValues() } });
        updateAdminSettings({ app: adminSettingsApplicationSchema.parse(form.getValues()) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const doPreviewTelemetry = () => {
    setLoading(true);

    getTelemetry()
      .then((data) => {
        setTelemetryData(data);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.application.page.title', {})} titleOrder={2}>
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
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label={t('common.form.name', {})}
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Select
            withAsterisk
            label={t('common.form.language', {})}
            data={languages.map((language) => ({
              label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
              value: language,
            }))}
            searchable
            key={form.key('language')}
            {...form.getInputProps('language')}
          />

          <Autocomplete
            withAsterisk
            label={t('pages.admin.settings.tabs.application.page.form.icon', {})}
            data={assets.items.map((asset) => asset.url)}
            key={form.key('icon')}
            {...form.getInputProps('icon')}
          />
          <Autocomplete
            label={t('pages.admin.settings.tabs.application.page.form.iconLight', {})}
            data={assets.items.map((asset) => asset.url)}
            key={form.key('iconLight')}
            {...form.getInputProps('iconLight')}
          />
          <Autocomplete
            label={t('pages.admin.settings.tabs.application.page.form.banner', {})}
            data={assets.items.map((asset) => asset.url)}
            key={form.key('banner')}
            {...form.getInputProps('banner')}
          />
          <Autocomplete
            label={t('pages.admin.settings.tabs.application.page.form.bannerLight', {})}
            data={assets.items.map((asset) => asset.url)}
            key={form.key('bannerLight')}
            {...form.getInputProps('bannerLight')}
          />

          <TextInput withAsterisk label={t('common.form.url', {})} {...form.getInputProps('url')} />

          <TextInput
            withAsterisk
            label={t('pages.admin.settings.tabs.application.page.form.sessionCookie', {})}
            {...form.getInputProps('sessionCookie')}
          />
          <TextInput
            withAsterisk
            label={t('pages.admin.settings.tabs.application.page.form.sessionDurationSeconds', {})}
            {...form.getInputProps('sessionDurationSeconds')}
          />

          <Select
            withAsterisk
            label={t('pages.admin.settings.tabs.application.page.form.twoFactorRequirement', {})}
            data={[
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
            ]}
            key={form.key('twoFactorRequirement')}
            {...form.getInputProps('twoFactorRequirement')}
          />

          <Switch
            label={t('pages.admin.settings.tabs.application.page.form.telemetryEnabled', {})}
            description={t('pages.admin.settings.tabs.application.page.form.telemetryEnabledDescription', {})}
            key={form.key('telemetryEnabled')}
            {...form.getInputProps('telemetryEnabled', { type: 'checkbox' })}
            onChange={(e) => {
              if (!e.target.checked) {
                setOpenModal('disableTelemetry');
              } else {
                form.setFieldValue('telemetryEnabled', true);
              }
            }}
          />
          <Switch
            label={t('pages.admin.settings.tabs.application.page.form.registrationEnabled', {})}
            name='registrationEnabled'
            key={form.key('registrationEnabled')}
            {...form.getInputProps('registrationEnabled', { type: 'checkbox' })}
            onChange={(e) => {
              if (e.target.checked) {
                setOpenModal('enableRegistration');
              } else {
                form.setFieldValue('registrationEnabled', false);
              }
            }}
          />
        </div>

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
