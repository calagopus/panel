import { z } from 'zod';
import getDatabaseHostDatabases from '@/api/admin/database-hosts/getDatabaseHostDatabases.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { adminServerDatabaseSchema } from '@/lib/schemas/admin/servers.ts';
import { databaseHostDatabaseTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import DatabaseRow from './DatabaseRow.tsx';

export default function AdminDatabaseHostDatabases({
  databaseHost,
}: {
  databaseHost: z.infer<typeof adminDatabaseHostSchema>;
}) {
  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.databaseHosts.databases(databaseHost.uuid),
    fetcher: (page, search) => getDatabaseHostDatabases(databaseHost.uuid, page, search),
  });

  const databaseHostDatabases = data ?? getEmptyPaginationSet<z.infer<typeof adminServerDatabaseSchema>>();

  return (
    <AdminSubContentContainer title={`Database Host Databases`} titleOrder={2} search={search} setSearch={setSearch}>
      <Table
        columns={databaseHostDatabaseTableColumns}
        loading={loading}
        pagination={databaseHostDatabases}
        onPageSelect={setPage}
      >
        {databaseHostDatabases.data.map((database) => (
          <DatabaseRow key={database.uuid} database={database} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
