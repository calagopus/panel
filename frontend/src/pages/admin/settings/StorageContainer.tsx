import { Group } from '@mantine/core';
import { UseFormReturnType, useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateStorageSettings from '@/api/admin/settings/updateStorageSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { storageDriverTypeLabelMapping } from '@/lib/enums.ts';
import {
  adminSettingsStorageFilesystemSchema,
  adminSettingsStorageS3Schema,
  adminSettingsStorageSchema,
} from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import StorageFilesystem from './forms/StorageFilesystem.tsx';
import StorageS3 from './forms/StorageS3.tsx';

export default function StorageContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const { storageDriver, updateSettings } = useAdminStore();

  const [openModal, setOpenModal] = useState<'changeStorageType' | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminSettingsStorageSchema>>({
    initialValues: {
      type: 'filesystem',
      path: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsStorageSchema),
  });

  useEffect(() => {
    form.setValues({
      ...storageDriver,
    });
  }, [storageDriver]);

  const doUpdate = () => {
    setLoading(true);
    updateStorageSettings(adminSettingsStorageSchema.parse(form.getValues()))
      .then(() => {
        addToast(t('pages.admin.settings.tabs.storage.page.toast.updated', {}), 'success');
        updateSettings({ storageDriver: adminSettingsStorageSchema.parse(form.getValues()) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.storage.page.title', {})} titleOrder={2}>
      <ConfirmationModal
        opened={openModal === 'changeStorageType'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.settings.tabs.storage.page.modal.changeStorageType.title', {})}
        confirm={t('pages.admin.settings.tabs.storage.page.modal.changeStorageType.button.confirm', {})}
        onConfirmed={() => {
          doUpdate();
          setOpenModal(null);
        }}
      >
        {t('pages.admin.settings.tabs.storage.page.modal.changeStorageType.content', {})}
      </ConfirmationModal>

      <form
        onSubmit={form.onSubmit(() =>
          form.values.type !== storageDriver.type ? setOpenModal('changeStorageType') : doUpdate(),
        )}
      >
        <Select
          label={t('pages.admin.settings.tabs.storage.page.form.driver', {})}
          data={Object.entries(storageDriverTypeLabelMapping).map(([value, label]) => ({
            value,
            label: label(),
          }))}
          key={form.key('type')}
          {...form.getInputProps('type')}
        />

        {form.getValues().type === 'filesystem' ? (
          <StorageFilesystem form={form as UseFormReturnType<z.infer<typeof adminSettingsStorageFilesystemSchema>>} />
        ) : form.getValues().type === 's3' ? (
          <StorageS3 form={form as UseFormReturnType<z.infer<typeof adminSettingsStorageS3Schema>>} />
        ) : null}

        <Group mt='md'>
          <AdminCan action='settings.update' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
