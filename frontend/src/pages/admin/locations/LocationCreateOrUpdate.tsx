import { useState } from 'react';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import createLocation from '@/api/admin/locations/createLocation.ts';
import deleteLocation from '@/api/admin/locations/deleteLocation.ts';
import updateLocation from '@/api/admin/locations/updateLocation.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationSchema, adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';
import LocationDuplicateModal from '@/pages/admin/locations/modals/LocationDuplicateModal.tsx';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { locationEmptyFormValues, locationToFormValues, useLocationFormFields } from './locationFormValues.tsx';

type LocationFormValues = z.infer<typeof adminLocationUpdateSchema>;

export default ({ contextLocation }: { contextLocation?: z.infer<typeof adminLocationSchema> }) => {
  const { t } = useTranslations();

  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const form = useFormEngine<LocationFormValues>('admin.locations.createOrUpdate', {
    schema: adminLocationUpdateSchema.unwrap(),
    initialValues: locationEmptyFormValues,
    validateInputOnBlur: true,
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

  useHydrateForm(form, contextLocation, locationToFormValues);

  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    defaultSearchValue: contextLocation?.backupConfiguration?.name,
    canRequest: canReadBackupConfigurations,
  });

  const fields = useLocationFormFields(backupConfigurations, canReadBackupConfigurations);

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
        {t('common.modal.delete.content', { name: form.getValues().name }).md()}
      </ConfirmationModal>

      {contextLocation && (
        <LocationDuplicateModal
          location={contextLocation}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.locations.all()))}>
        <FormEngine form={form} fields={fields} />

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
