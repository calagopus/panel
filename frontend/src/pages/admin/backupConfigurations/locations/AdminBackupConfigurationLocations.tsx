import { z } from 'zod';
import getBackupConfigurationLocations from '@/api/admin/backup-configurations/locations/getBackupConfigurationLocations.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { locationTableColumns } from '@/lib/tableColumns.ts';
import LocationRow from '@/pages/admin/locations/LocationRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';

export default function AdminBackupConfigurationLocations({
  backupConfiguration,
}: {
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backupConfigurations.locations(backupConfiguration.uuid),
    fetcher: (page, search) => getBackupConfigurationLocations(backupConfiguration.uuid, page, search),
  });

  const backupConfigurationLocations = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminSubContentContainer title={`Backup Config Locations`} titleOrder={2} search={search} setSearch={setSearch}>
      <Table
        columns={locationTableColumns}
        loading={loading}
        pagination={backupConfigurationLocations}
        onPageSelect={setPage}
      >
        {backupConfigurationLocations.data.map((location) => (
          <LocationRow key={location.uuid} location={location} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
