import { countryFlagCodes } from 'virtual:country-flags';
import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import Select from '@/elements/input/Select.tsx';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationSchema, adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type LocationFormValues = z.infer<typeof adminLocationUpdateSchema>;

export const locationEmptyFormValues: LocationFormValues = {
  name: '',
  description: null,
  flag: null,
  backupConfigurationUuid: null,
};

export const locationToFormValues = (location: z.infer<typeof adminLocationSchema>): Partial<LocationFormValues> => ({
  name: location.name,
  description: location.description,
  flag: location.flag,
  backupConfigurationUuid: location.backupConfiguration?.uuid ?? null,
});

export function useLocationFormFields(
  backupConfigurations: ReturnType<typeof useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>>,
  canReadBackupConfigurations: boolean,
): FieldDef<LocationFormValues>[] {
  const { t, language } = useTranslations();

  return [
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
}
