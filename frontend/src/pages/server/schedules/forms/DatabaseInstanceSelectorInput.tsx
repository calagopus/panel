import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import getDatabaseInstances from '@/api/server/databases/instances/getDatabaseInstances.ts';
import Select from '@/elements/input/Select.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useServerStore } from '@/stores/server.ts';

export default function DatabaseInstanceSelectorInput({
  form,
  field,
  label,
  description,
  placeholder,
  withAsterisk = false,
  allowNull = true,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
  field: 'action.databaseInstanceUuid' | 'action.sourceDatabaseInstanceUuid';
  label: string;
  description?: string;
  placeholder?: string;
  withAsterisk?: boolean;
  allowNull?: boolean;
}) {
  const server = useServerStore((state) => state.server);

  const canReadInstances = useServerCan('database-instances.read');
  const instances = useSearchableResource<z.infer<typeof serverDatabaseInstanceSchema>>({
    queryKey: queryKeys.server(server.uuid).databases.instances.all(),
    fetcher: (search) => getDatabaseInstances(server.uuid, 1, search),
    canRequest: canReadInstances,
  });

  return (
    <Select
      withAsterisk={withAsterisk}
      label={label}
      description={description}
      placeholder={placeholder}
      clearable={allowNull}
      data={instances.items.map((instance) => ({
        value: instance.uuid,
        label: `${instance.name} (${databaseAgentTypeLabelMapping[instance.type]})`,
      }))}
      value={form.getInputProps(field).value || null}
      error={form.getInputProps(field).error}
      searchable
      searchValue={instances.search}
      onSearchChange={instances.setSearch}
      loading={instances.loading}
      onChange={(value) => form.setFieldValue(field, allowNull ? value : (value ?? ''))}
    />
  );
}
