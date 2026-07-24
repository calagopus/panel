import { countryFlagCodes } from 'virtual:country-flags';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import createLocation from '@/api/admin/locations/createLocation.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Select from '@/elements/input/Select.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

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
  const { language, t } = useTranslations();
  const { addToast } = useToast();

  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<LocationFormValues>({
    formId: 'admin.nodes.locationModal',
    schema: adminLocationUpdateSchema.unwrap(),
    initialValues: {
      name: '',
      description: null,
      flag: null,
      backupConfigurationUuid: null,
    },
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

  const fields: FieldDef<LocationFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'backupConfigurationUuid',
      label: t('common.form.backupConfiguration', {}),
      options: backupConfigurations.items.map((bc) => ({ label: bc.name, value: bc.uuid })),
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
          data={countryFlagCodes.map((countryCode) => {
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
