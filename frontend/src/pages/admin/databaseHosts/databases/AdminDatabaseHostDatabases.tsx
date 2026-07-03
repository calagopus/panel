import { z } from 'zod';
import getDatabaseHostDatabases from '@/api/admin/database-hosts/getDatabaseHostDatabases.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { databaseHostDatabaseTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseRow from './DatabaseRow.tsx';

export default function AdminDatabaseHostDatabases({
  databaseHost,
}: {
  databaseHost: z.infer<typeof adminDatabaseHostSchema>;
}) {
  const { t } = useTranslations();
  const {
    data: databaseHostDatabases,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.databaseHosts.databases(databaseHost.uuid),
    fetcher: (page, search) => getDatabaseHostDatabases(databaseHost.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseHosts.tabs.databases.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
    >
      <Table
        columns={databaseHostDatabaseTableColumns()}
        loading={loading}
        error={error}
        pagination={databaseHostDatabases}
        onPageSelect={setPage}
      >
        {databaseHostDatabases?.data.map((database) => (
          <DatabaseRow key={database.uuid} database={database} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
