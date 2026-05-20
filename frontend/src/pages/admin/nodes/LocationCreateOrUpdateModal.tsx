import { Stack, Text } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { basename } from 'pathe';
import { useState } from 'react';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import createLocation from '@/api/admin/locations/createLocation.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const flags = import.meta.glob('/node_modules/svg-country-flags/svg/*.svg', { import: 'metadata' });

interface LocationCreateOrUpdateModalProps {
  opened: boolean;
  onClose: () => void;
  onLocationCreated: () => void;
}

export default function LocationCreateOrUpdateModal({
  opened,
  onClose,
  onLocationCreated,
}: LocationCreateOrUpdateModalProps) {
  const { language } = useTranslations();
  const { addToast } = useToast();

  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');
  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof adminLocationUpdateSchema>>(
    {
      initialValues: {
        name: '',
        description: null,
        flag: null,
        backupConfigurationUuid: null,
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(adminLocationUpdateSchema),
    },
    onClose,
  );

  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    defaultSearchValue: '',
    canRequest: canReadBackupConfigurations,
  });

  const handleSubmit = async () => {
    if (!form.isValid()) {
      return;
    }

    setLoading(true);
    try {
      await createLocation(adminLocationUpdateSchema.parse(form.getValues()));
      addToast('Location created.', 'success');
      form.reset();
      onLocationCreated();
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title='Create Location' size='lg'>
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          You need to create at least one location before you can create nodes. Locations help organize your nodes
          geographically or logically.
        </Text>

        <form onSubmit={form.onSubmit(handleSubmit)}>
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

            <TextArea label='Description' placeholder='Description' rows={3} {...form.getInputProps('description')} />

            <Select
              label='Flag'
              placeholder='None'
              renderOption={({ option }) => (
                <div className='flex items-center gap-2'>
                  <img src={`/flags/${option.value}.svg`} alt={option.label} className='w-4 h-4 rounded-md shrink-0' />
                  <span className='truncate'>{option.label}</span>
                </div>
              )}
              data={Object.keys(flags)
                .filter((flag) => basename(flag, '.svg').length === 2)
                .map((flag) => {
                  const countryCode = basename(flag, '.svg');
                  const regionNames = new Intl.DisplayNames([language], { type: 'region' });

                  return {
                    label: regionNames.of(countryCode.toUpperCase()) || countryCode,
                    value: countryCode,
                  };
                })}
              clearable
              searchable
              key={form.key('flag')}
              {...form.getInputProps('flag')}
            />
          </div>

          <ModalFooter>
            <AdminCan action='locations.create' cantSave>
              <Button type='submit' disabled={!form.isValid()} loading={loading}>
                Create Location
              </Button>
            </AdminCan>
            <Button variant='default' onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </form>
      </Stack>
    </Modal>
  );
}
