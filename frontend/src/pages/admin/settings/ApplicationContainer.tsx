import { Group, Stack } from '@mantine/core';
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
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import TelemetryPreviewModal from './modals/TelemetryPreviewModal.tsx';

export default function ApplicationContainer() {
  const { addToast } = useToast();
  const { app } = useAdminStore();
  const { languages, settings, updateSettings } = useGlobalStore();

  const [loading, setLoading] = useState(false);
  const [telemetryData, setTelemetryData] = useState<object | null>(null);
  const [openModal, setOpenModal] = useState<'disableTelemetry' | 'enableRegistration' | null>(null);
  const canReadAssets = useAdminCan('assets.read');

  const form = useForm<z.infer<typeof adminSettingsApplicationSchema>>({
    initialValues: {
      name: '',
      icon: '',
      banner: null,
      url: '',
      language: 'en',
      twoFactorRequirement: 'none',
      telemetryEnabled: true,
      registrationEnabled: true,
      languageChangeEnabled: true,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsApplicationSchema),
  });

  const assets = useSearchableResource<z.infer<typeof storageAssetSchema>>({
    queryKey: queryKeys.admin.assets.all(),
    fetcher: () => getAssets(1),
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
        addToast('Application settings updated.', 'success');
        updateSettings({ app: { ...settings.app, ...form.getValues() } });
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
    <AdminSubContentContainer title='Application Settings' titleOrder={2}>
      <TelemetryPreviewModal
        telemetry={telemetryData}
        opened={telemetryData !== null}
        onClose={() => setTelemetryData(null)}
      />
      <ConfirmationModal
        opened={openModal === 'disableTelemetry'}
        onClose={() => setOpenModal(null)}
        title='Confirm Disabling Telemetry'
        confirm='Disable'
        onConfirmed={() => {
          form.setFieldValue('telemetryEnabled', false);
          setOpenModal(null);
        }}
      >
        Are you sure you want to disable telemetry? Telemetry helps us improve Calagopus by providing anonymous usage
        data. Disabling telemetry will prevent any data from being sent.
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'enableRegistration'}
        onClose={() => setOpenModal(null)}
        title='Confirm Enabling Registration'
        confirm='Enable'
        onConfirmed={() => {
          form.setFieldValue('registrationEnabled', true);
          setOpenModal(null);
        }}
      >
        Are you sure you want to enable registration? Enabling registration allows anyone to create an account on this
        panel. If you do not have a captcha configured, this may be a mistake.
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <Stack>
          <Group grow>
            <TextInput
              withAsterisk
              label='Name'
              placeholder='Name'
              key={form.key('name')}
              {...form.getInputProps('name')}
            />
            <Select
              withAsterisk
              label='Language'
              placeholder='Language'
              data={languages.map((language) => ({
                label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
                value: language,
              }))}
              searchable
              key={form.key('language')}
              {...form.getInputProps('language')}
            />
          </Group>

          <Group grow>
            <Autocomplete
              withAsterisk
              label='Icon'
              placeholder='Icon'
              data={assets.items.map((asset) => asset.url)}
              key={form.key('icon')}
              {...form.getInputProps('icon')}
            />
            <Autocomplete
              label='Banner'
              placeholder='Banner'
              data={assets.items.map((asset) => asset.url)}
              key={form.key('banner')}
              {...form.getInputProps('banner')}
            />
          </Group>

          <Group grow>
            <TextInput withAsterisk label='URL' placeholder='URL' {...form.getInputProps('url')} />
            <Select
              withAsterisk
              label='Two-Factor Authentication Requirement'
              data={[
                { label: 'Admins', value: 'admins' },
                { label: 'All Users', value: 'all_users' },
                { label: 'None', value: 'none' },
              ]}
              key={form.key('twoFactorRequirement')}
              {...form.getInputProps('twoFactorRequirement')}
            />
          </Group>

          <Group grow>
            <Switch
              label='Enable Telemetry'
              description='Allow Calagopus to collect limited and anonymous usage data to help improve the application.'
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
              label='Enable Registration'
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
          </Group>

          <Switch
            label='Allow Users to Change Language'
            name='languageChangeEnabled'
            key={form.key('languageChangeEnabled')}
            {...form.getInputProps('languageChangeEnabled', { type: 'checkbox' })}
          />
        </Stack>

        <Group mt='md'>
          <AdminCan action='settings.update' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              Save
            </Button>
          </AdminCan>
          <AdminCan action='stats.read'>
            <Button variant='outline' loading={loading} onClick={doPreviewTelemetry}>
              Preview Telemetry
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
