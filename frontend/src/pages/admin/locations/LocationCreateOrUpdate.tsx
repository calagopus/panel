import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { basename } from 'pathe';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import createLocation from '@/api/admin/locations/createLocation.ts';
import deleteLocation from '@/api/admin/locations/deleteLocation.ts';
import updateLocation from '@/api/admin/locations/updateLocation.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationSchema, adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';
import LocationDuplicateModal from '@/pages/admin/locations/modals/LocationDuplicateModal.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const flags = import.meta.glob('/node_modules/svg-country-flags/svg/*.svg', { import: 'metadata' });

type LocationFormValues = z.infer<typeof adminLocationUpdateSchema>;

export default ({ contextLocation }: { contextLocation?: z.infer<typeof adminLocationSchema> }) => {
  const { t, language } = useTranslations();

  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const {
    formExtension,
    zodShape,
    initialValues: extInitialValues,
  } = useFormExtensions<LocationFormValues>('admin.locations.createOrUpdate');
  const mergedSchema = adminLocationUpdateSchema.unwrap().extend(zodShape);

  const form = useForm<LocationFormValues>({
    initialValues: {
      name: '',
      description: null,
      flag: null,
      backupConfigurationUuid: null,
      ...(extInitialValues as Partial<LocationFormValues>),
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(mergedSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    LocationFormValues,
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
    resourceName: t('pages.admin.locations.resourceName', {}),
  });

  useEffect(() => {
    if (contextLocation) {
      form.setValues({
        name: contextLocation.name,
        description: contextLocation.description,
        flag: contextLocation.flag,
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

  const fields: FieldDef<LocationFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'backupConfigurationUuid',
      label: t('common.form.backupConfiguration', {}),
      options: backupConfigurations.items.map((b) => ({ label: b.name, value: b.uuid })),
      props: {
        placeholder: t('common.none', {}),
        searchable: true,
        searchValue: backupConfigurations.search,
        onSearchChange: backupConfigurations.setSearch,
        allowDeselect: true,
        clearable: true,
        disabled: !canReadBackupConfigurations,
        loading: backupConfigurations.loading,
      },
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
    {
      type: 'custom',
      name: 'flag',
      render: (f) => (
        <Select
          label={t('pages.admin.locations.tabs.general.page.form.flag', {})}
          placeholder={t('common.none', {})}
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
          key={f.key('flag')}
          {...f.getInputProps('flag')}
        />
      ),
    },
  ];

  return (
    <AdminContentContainer
      title={t(
        contextLocation
          ? 'pages.admin.locations.tabs.general.page.titleUpdate'
          : 'pages.admin.locations.tabs.general.page.titleCreate',
        {},
      )}
      fullscreen={!!contextLocation}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.locations.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.locations.tabs.general.page.modal.delete.content', { name: form.getValues().name }).md()}
      </ConfirmationModal>

      {contextLocation && (
        <LocationDuplicateModal
          location={contextLocation}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.locations.all()))}>
        <FormEngine form={form} fields={fields} extensions={[formExtension]} />

        <Group mt='md'>
          <AdminCan action={contextLocation ? 'locations.update' : 'locations.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextLocation && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextLocation && (
            <AdminCan action='locations.create'>
              <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                {t('common.button.duplicate', {})}
              </Button>
            </AdminCan>
          )}
          {contextLocation && (
            <AdminCan action='locations.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
};
