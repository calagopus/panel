import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import createLocation from '@/api/admin/locations/createLocation.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { FormEngine } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { locationEmptyFormValues, useLocationFormFields } from '../locationFormValues.tsx';

interface LocationCreateOrUpdateModalProps {
  opened: boolean;
  onClose: () => void;
  onLocationCreated: () => void;
}

type LocationFormValues = z.infer<typeof adminLocationUpdateSchema>;

export default function LocationCreateOrUpdateModal({
  opened,
  onClose,
  onLocationCreated,
}: LocationCreateOrUpdateModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<LocationFormValues>({
    formId: 'admin.nodes.locationModal',
    schema: adminLocationUpdateSchema.unwrap(),
    initialValues: locationEmptyFormValues,
    onClose,
    onSubmit: async (values) => {
      await createLocation(adminLocationUpdateSchema.parse(values));
      addToast(
        t('elements.resource.tooltip.created', { resource: t('pages.admin.locations.resourceName', {}) }),
        'success',
      );
      onLocationCreated();
    },
  });

  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    defaultSearchValue: '',
    canRequest: canReadBackupConfigurations,
  });

  const fields = useLocationFormFields(backupConfigurations, canReadBackupConfigurations);

  return (
    <FormModal
      opened={opened}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      title={t('pages.admin.locations.tabs.general.page.titleCreate', {})}
      size='lg'
    >
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          {t('pages.admin.nodes.tabs.general.page.alert.noLocations', {})}
        </Text>

        <FormEngine form={form} fields={fields} />

        <ModalFooter>
          <AdminCan action='locations.create' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('pages.admin.locations.tabs.general.page.titleCreate', {})}
            </Button>
          </AdminCan>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
