import { Group, Tooltip } from '@mantine/core';
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
import { useAdminStore } from '@/stores/admin.tsx';
import StorageFilesystem from './forms/StorageFilesystem.tsx';
import StorageS3 from './forms/StorageS3.tsx';

export default function StorageContainer() {
  const { addToast } = useToast();
  const { storageDriver } = useAdminStore();

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
        addToast('Storage settings updated.', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title='Storage Settings' titleOrder={2}>
      <ConfirmationModal
        opened={openModal === 'changeStorageType'}
        onClose={() => setOpenModal(null)}
        title='Confirm Changing Storage Type'
        confirm='Update'
        onConfirmed={() => {
          doUpdate();
          setOpenModal(null);
        }}
      >
        Are you sure you want to change the storage type? Changing the storage type will cause the application to look
        for assets (e.g. profile pictures) in a different location, which may result in missing assets if they are not
        moved to the new location manually.
      </ConfirmationModal>

      <form
        onSubmit={form.onSubmit(() =>
          form.values.type !== storageDriver.type ? setOpenModal('changeStorageType') : doUpdate(),
        )}
      >
        <Select
          label='Driver'
          data={Object.entries(storageDriverTypeLabelMapping).map(([value, label]) => ({
            value,
            label,
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
          <AdminCan
            action='settings.update'
            renderOnCant={
              <Tooltip label='You do not have permission to update settings.'>
                <Button disabled>Save</Button>
              </Tooltip>
            }
          >
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              Save
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
