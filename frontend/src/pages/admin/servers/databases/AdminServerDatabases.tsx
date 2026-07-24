import { z } from 'zod';
import getServerDatabases from '@/api/admin/servers/databases/getServerDatabases.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Stack from '@/elements/Stack.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverDatabaseTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminServerDatabaseInstances from './AdminServerDatabaseInstances.tsx';
import AdminServerDatabaseRow from './AdminServerDatabaseRow.tsx';

export default function AdminServerDatabases({ server }: { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const {
    data: databases,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.servers.databases(server.uuid),
    fetcher: (page, search) => getServerDatabases(server.uuid, page, search),
  });

  return (
    <Stack>
      <AdminSubContentContainer
        title={t('pages.admin.servers.tabs.databases.page.databases.title', {})}
        titleOrder={2}
        search={search}
        setSearch={setSearch}
        registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.databases.subContainer}
        registryProps={{ server }}
      >
        <Table
          columns={serverDatabaseTableColumns()}
          loading={loading}
          error={error}
          pagination={databases}
          onPageSelect={setPage}
        >
          {databases?.data.map((database) => (
            <AdminServerDatabaseRow key={database.uuid} server={server} database={database} />
          ))}
        </Table>
      </AdminSubContentContainer>

      <AdminServerDatabaseInstances server={server} />
    </Stack>
  );
}
