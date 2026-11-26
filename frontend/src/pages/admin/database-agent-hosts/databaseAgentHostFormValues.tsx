import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import TextInput from '@/elements/input/TextInput.tsx';
import UrlMissingPortAlert from '@/elements/UrlMissingPortAlert.tsx';
import { DATABASE_AGENT_DEFAULT_PORT } from '@/lib/domain/databaseAgentHost.ts';
import { databaseAgentTypeDefaultPortMapping, databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { getUrlConnectPort, withUrlPort } from '@/lib/network/url.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import {
  adminDatabaseAgentHostSchema,
  adminDatabaseAgentHostUpdateSchema,
} from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type DatabaseAgentHostFormValues = z.infer<typeof adminDatabaseAgentHostUpdateSchema>;
type DatabaseAgentTypeKey = keyof typeof databaseAgentTypeLabelMapping;

export const databaseAgentHostEmptyFormValues: DatabaseAgentHostFormValues = {
  backupConfigurationUuid: null,
  name: '',
  description: null,
  deploymentEnabled: true,
  maintenanceEnabled: false,
  url: '',
  memory: 0,
  disk: 0,
  types: Object.fromEntries(
    (Object.keys(databaseAgentTypeLabelMapping) as DatabaseAgentTypeKey[]).map((type) => [
      type,
      { enabled: true, publicHost: null, publicPort: databaseAgentTypeDefaultPortMapping[type] },
    ]),
  ) as DatabaseAgentHostFormValues['types'],
};

export const databaseAgentHostToFormValues = (
  host: z.infer<typeof adminDatabaseAgentHostSchema>,
): Partial<DatabaseAgentHostFormValues> => ({
  backupConfigurationUuid: host.backupConfiguration?.uuid ?? null,
  name: host.name,
  description: host.description,
  deploymentEnabled: host.deploymentEnabled,
  maintenanceEnabled: host.maintenanceEnabled,
  url: host.url,
  memory: host.memory,
  disk: host.disk,
  types: host.types,
});

const typeEnabled = (type: string) => (values: DatabaseAgentHostFormValues) =>
  values.types?.[type as DatabaseAgentTypeKey]?.enabled !== false;

export function useDatabaseAgentHostFormFields({
  urlValue,
  backupConfigurations,
}: {
  urlValue: string;
  backupConfigurations: ReturnType<
    typeof useInfiniteSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>
  >;
}): FieldDef<DatabaseAgentHostFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'custom',
      name: 'url',
      render: (f) => (
        <div className='flex flex-col gap-2'>
          <TextInput
            withAsterisk
            label={t('common.form.url', {})}
            placeholder='https://agent.example.com:8090'
            key={f.key('url')}
            {...f.getInputProps('url')}
          />
          <UrlMissingPortAlert
            url={urlValue}
            defaultPort={DATABASE_AGENT_DEFAULT_PORT}
            onAddPort={() => f.setFieldValue('url', withUrlPort(urlValue, DATABASE_AGENT_DEFAULT_PORT))}
          >
            {t('pages.admin.databaseAgentHosts.tabs.general.page.alert.urlMissingPort', {
              port: String(getUrlConnectPort(urlValue) ?? 443),
              agentPort: String(DATABASE_AGENT_DEFAULT_PORT),
            }).md()}
          </UrlMissingPortAlert>
        </div>
      ),
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), colSpan: 'full' },
    {
      type: 'size',
      name: 'memory',
      label: t('common.form.memory', {}),
      required: true,
      description: t('pages.admin.databaseAgentHosts.tabs.general.page.form.memoryDescription', {}),
      tooltip: t('common.form.unlimitedHint', {}),
      mode: 'mb',
      min: 0,
    },
    {
      type: 'size',
      name: 'disk',
      label: t('common.form.disk', {}),
      required: true,
      description: t('pages.admin.databaseAgentHosts.tabs.general.page.form.diskDescription', {}),
      tooltip: t('common.form.unlimitedHint', {}),
      mode: 'mb',
      min: 0,
    },
    {
      type: 'select',
      name: 'backupConfigurationUuid',
      label: t('common.form.backupConfiguration', {}),
      options: backupConfigurations.items.map((b) => ({ label: b.name, value: b.uuid })),
      props: {
        placeholder: t('pages.admin.databaseAgentHosts.tabs.general.page.form.backupConfigurationPlaceholder', {}),
        searchable: true,
        searchValue: backupConfigurations.search,
        onSearchChange: backupConfigurations.setSearch,
        infiniteScroll: backupConfigurations.infiniteScroll,
        allowDeselect: true,
        clearable: true,
        loading: backupConfigurations.loading,
      },
    },
    { type: 'switch', name: 'deploymentEnabled', label: t('common.form.deploymentEnabled', {}) },
    { type: 'switch', name: 'maintenanceEnabled', label: t('common.form.maintenanceEnabled', {}) },
    ...Object.entries(databaseAgentTypeLabelMapping).flatMap(
      ([type, label]): FieldDef<DatabaseAgentHostFormValues>[] => [
        {
          type: 'divider',
          name: `types.${type}.divider`,
          label,
          switchName: `types.${type}.enabled`,
          switchLabel: t('common.form.enabled', {}),
        },
        {
          type: 'text',
          name: `types.${type}.publicHost`,
          label: t('pages.admin.databaseAgentHosts.tabs.general.page.form.typePublicHost', {}),
          when: typeEnabled(type),
        },
        {
          type: 'number',
          name: `types.${type}.publicPort`,
          label: t('pages.admin.databaseAgentHosts.tabs.general.page.form.typePublicPort', {}),
          props: {
            min: 1,
            max: 65535,
            placeholder: String(
              databaseAgentTypeDefaultPortMapping[type as keyof typeof databaseAgentTypeDefaultPortMapping],
            ),
          },
          when: typeEnabled(type),
        },
      ],
    ),
  ];
}
