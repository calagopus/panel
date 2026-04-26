import { Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import createLocation from '@/api/admin/locations/createLocation.ts';
import deleteLocation from '@/api/admin/locations/deleteLocation.ts';
import updateLocation from '@/api/admin/locations/updateLocation.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationSchema, adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';

export default ({ contextLocation }: { contextLocation?: z.infer<typeof adminLocationSchema> }) => {
  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminLocationUpdateSchema>>({
    initialValues: {
      name: '',
      description: null,
      backupConfigurationUuid: null,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminLocationUpdateSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminLocationUpdateSchema>,
    z.infer<typeof adminLocationSchema>
  >({
    form,
    createFn: () => createLocation(adminLocationUpdateSchema.parse(form.getValues())),
    updateFn: contextLocation
      ? () => updateLocation(contextLocation.uuid, adminLocationUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextLocation ? () => deleteLocation(contextLocation.uuid) : undefined,
    doUpdate: !!contextLocation,
    basePath: '/admin/locations',
    resourceName: 'Location',
  });

  useEffect(() => {
    if (contextLocation) {
      form.setValues({
        name: contextLocation.name,
        description: contextLocation.description,
        backupConfigurationUuid: contextLocation.backupConfiguration?.uuid ?? null,
      });
    }
  }, [contextLocation]);

  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    defaultSearchValue: contextLocation?.backupConfiguration?.name,
    canRequest: canReadBackupConfigurations,
  });

  return (
    <AdminContentContainer
      title={`${contextLocation ? 'Update' : 'Create'} Location`}
      fullscreen={!!contextLocation}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Location Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'locations']))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label='Name'
            placeholder='Name'
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Select
            label='Backup Configuration'
            placeholder='None'
            data={backupConfigurations.items.map((backupConfiguration) => ({
              label: backupConfiguration.name,
              value: backupConfiguration.uuid,
            }))}
            searchable
            searchValue={backupConfigurations.search}
            onSearchChange={backupConfigurations.setSearch}
            allowDeselect
            clearable
            disabled={!canReadBackupConfigurations}
            loading={backupConfigurations.loading}
            key={form.key('backupConfigurationUuid')}
            {...form.getInputProps('backupConfigurationUuid')}
          />

          <TextArea
            label='Description'
            placeholder='Description'
            className='col-span-full'
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />
        </div>

        <Group mt='md'>
          <AdminCan action={contextLocation ? 'locations.update' : 'locations.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              Save
            </Button>
            {!contextLocation && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                Save & Stay
              </Button>
            )}
          </AdminCan>
          {contextLocation && (
            <AdminCan action='locations.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                Delete
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
};
