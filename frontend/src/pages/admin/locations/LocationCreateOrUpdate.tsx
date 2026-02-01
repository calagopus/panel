import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { NIL as uuidNil } from 'uuid';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import createLocation from '@/api/admin/locations/createLocation.ts';
import deleteLocation from '@/api/admin/locations/deleteLocation.ts';
import updateLocation from '@/api/admin/locations/updateLocation.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer';

export default ({ contextLocation }: { contextLocation?: Location }) => {
  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminLocationSchema>>({
    initialValues: {
      name: '',
      description: null,
      backupConfigurationUuid: uuidNil,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminLocationSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<z.infer<typeof adminLocationSchema>, Location>({
    form,
    createFn: () => createLocation(form.values),
    updateFn: () => updateLocation(contextLocation!.uuid, form.values),
    deleteFn: () => deleteLocation(contextLocation!.uuid),
    doUpdate: !!contextLocation,
    basePath: '/admin/locations',
    resourceName: 'Location',
  });

  useEffect(() => {
    if (contextLocation) {
      form.setValues({
        name: contextLocation.name,
        description: contextLocation.description,
        backupConfigurationUuid: contextLocation.backupConfiguration?.uuid ?? uuidNil,
      });
    }
  }, [contextLocation]);

  const backupConfigurations = useSearchableResource<BackupConfiguration>({
    fetcher: (search) => getBackupConfigurations(1, search),
    defaultSearchValue: contextLocation?.backupConfiguration?.name,
    canRequest: canReadBackupConfigurations,
  });

  return (
    <AdminContentContainer title={`${contextLocation ? 'Update' : 'Create'} Location`} titleOrder={2}>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Location Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.values.name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false))}>
        <Stack mt='xs'>
          <Group grow>
            <TextInput withAsterisk label='Name' placeholder='Name' {...form.getInputProps('name')} />
            <Select
              allowDeselect
              label='Backup Configuration'
              data={[
                {
                  label: 'None',
                  value: uuidNil,
                },
                ...backupConfigurations.items.map((backupConfiguration) => ({
                  label: backupConfiguration.name,
                  value: backupConfiguration.uuid,
                })),
              ]}
              searchable
              searchValue={backupConfigurations.search}
              onSearchChange={backupConfigurations.setSearch}
              disabled={!canReadBackupConfigurations}
              {...form.getInputProps('backupConfigurationUuid')}
            />
          </Group>

          <Group grow align='start'>
            <TextArea label='Description' placeholder='Description' rows={3} {...form.getInputProps('description')} />
          </Group>

          <Group>
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
        </Stack>
      </form>
    </AdminContentContainer>
  );
};
