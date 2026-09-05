import { faUnlockKeyhole } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import Select from '@/elements/input/Select.tsx';
import { databaseCredentialTypeLabelMapping, databaseTypeLabelMapping, mappingToSelectData } from '@/lib/enums.ts';
import {
  adminDatabaseCredentialsConnectionStringSchema,
  adminDatabaseCredentialsDetailsSchema,
  adminDatabaseCredentialsUpdateSchema,
  adminDatabaseHostSchema,
  adminDatabaseHostUpdateSchema,
} from '@/lib/schemas/admin/databaseHosts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import CredentialConnectionString from './forms/CredentialConnectionString.tsx';
import CredentialDetails from './forms/CredentialDetails.tsx';

type DatabaseHostFormValues = z.infer<typeof adminDatabaseHostUpdateSchema>;

export type AdminDatabaseCredentialType = z.infer<typeof adminDatabaseCredentialsUpdateSchema>['type'];

export const adminDatabaseCredentialsDefaults: Record<
  AdminDatabaseCredentialType,
  z.infer<typeof adminDatabaseCredentialsUpdateSchema>
> = {
  connection_string: { type: 'connection_string', connectionString: '' },
  details: { type: 'details', username: '', password: '', host: '', port: 3306 },
};

export const databaseHostEmptyFormValues: DatabaseHostFormValues = {
  name: '',
  type: 'mysql',
  deploymentEnabled: true,
  maintenanceEnabled: false,
  publicHost: null,
  publicPort: null,
  credentials: undefined,
};

export const databaseHostToFormValues = (
  databaseHost: z.infer<typeof adminDatabaseHostSchema>,
): Partial<DatabaseHostFormValues> => ({
  name: databaseHost.name,
  type: databaseHost.type,
  deploymentEnabled: databaseHost.deploymentEnabled,
  maintenanceEnabled: databaseHost.maintenanceEnabled,
  publicHost: databaseHost.publicHost,
  publicPort: databaseHost.publicPort,
  credentials: undefined,
});

export function useDatabaseHostFormFields(
  contextDatabaseHost?: z.infer<typeof adminDatabaseHostSchema>,
): FieldDef<DatabaseHostFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'type',
      label: t('common.form.type', {}),
      required: true,
      options: Object.entries(databaseTypeLabelMapping).map(([value, label]) => ({ value, label })),
      props: { disabled: !!contextDatabaseHost },
    },
    { type: 'text', name: 'publicHost', label: t('pages.admin.databaseHosts.tabs.general.page.form.publicHost', {}) },
    {
      type: 'number',
      name: 'publicPort',
      label: t('pages.admin.databaseHosts.tabs.general.page.form.publicPort', {}),
    },
    {
      type: 'custom',
      name: 'credentials',
      colSpan: 'full',
      render: (f) => (
        <CollapsibleSection
          icon={<FontAwesomeIcon icon={faUnlockKeyhole} />}
          enabled={!!f.values.credentials}
          onToggle={(enabled) =>
            f.setValues({
              credentials: enabled
                ? (contextDatabaseHost?.credentials ?? adminDatabaseCredentialsDefaults.connection_string)
                : undefined,
            })
          }
          title={t('pages.admin.databaseHosts.tabs.general.page.form.connectionCredentials', {})}
        >
          <Select
            withAsterisk
            label={t('pages.admin.databaseHosts.tabs.general.page.form.credentialType', {})}
            data={mappingToSelectData(databaseCredentialTypeLabelMapping)}
            key={f.key('credentials.type')}
            {...f.getInputProps('credentials.type')}
            onChange={(value) => {
              if (value && value !== f.values.credentials?.type) {
                f.setValues({ credentials: adminDatabaseCredentialsDefaults[value as AdminDatabaseCredentialType] });
              }
            }}
          />

          {f.values.credentials?.type === 'connection_string' ? (
            <CredentialConnectionString
              form={
                f as UseFormReturnType<{
                  credentials: z.infer<typeof adminDatabaseCredentialsConnectionStringSchema>;
                }>
              }
            />
          ) : f.values.credentials?.type === 'details' ? (
            <CredentialDetails
              form={
                f as UseFormReturnType<{
                  credentials: z.infer<typeof adminDatabaseCredentialsDetailsSchema>;
                }>
              }
            />
          ) : null}
        </CollapsibleSection>
      ),
    },
    { type: 'switch', name: 'deploymentEnabled', label: t('common.form.deploymentEnabled', {}) },
    { type: 'switch', name: 'maintenanceEnabled', label: t('common.form.maintenanceEnabled', {}) },
  ];
}
