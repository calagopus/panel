import { z } from 'zod';
import getDatabaseAgentHostInstances from '@/api/admin/database-agent-hosts/getDatabaseAgentHostInstances.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { databaseAgentHostInstanceTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseAgentRow from './DatabaseAgentRow.tsx';

export default function AdminDatabaseAgentHostInstances({
  databaseAgentHost,
}: {
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
}) {
  const { t } = useTranslations();
  const {
    data: instances,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.databaseAgentHosts.instances(databaseAgentHost.uuid),
    fetcher: (page, search) => getDatabaseAgentHostInstances(databaseAgentHost.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseAgentHosts.tabs.instances.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentHosts.view.instances.subContainer}
      registryProps={{ databaseAgentHost }}
    >
      <Table
        columns={databaseAgentHostInstanceTableColumns()}
        loading={loading}
        error={error}
        pagination={instances}
        onPageSelect={setPage}
      >
        {instances?.data.map((databaseAgent) => (
          <DatabaseAgentRow
            key={databaseAgent.uuid}
            databaseAgentHost={databaseAgentHost}
            databaseAgent={databaseAgent}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
