import { z } from 'zod';
import getBackupConfigurationDatabaseAgentHosts from '@/api/admin/backup-configurations/database-agent-hosts/getBackupConfigurationDatabaseAgentHosts.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { databaseAgentHostTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseAgentHostRow from '../../database-agent-hosts/DatabaseAgentHostRow.tsx';

export default function AdminBackupConfigurationDatabaseAgentHosts({
  backupConfiguration,
}: {
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const { t } = useTranslations();
  const {
    data: backupConfigurationDatabaseAgentHosts,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backupConfigurations.databaseAgentHosts(backupConfiguration.uuid),
    fetcher: (page, search, perPage) =>
      getBackupConfigurationDatabaseAgentHosts(backupConfiguration.uuid, page, search, perPage),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.backupConfigurations.tabs.databaseAgentHosts.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={
        window.extensionContext.extensionRegistry.pages.admin.backupConfigurations.view.databaseAgentHosts.subContainer
      }
      registryProps={{ backupConfiguration }}
    >
      <Table
        columns={databaseAgentHostTableColumns()}
        loading={loading}
        pagination={backupConfigurationDatabaseAgentHosts}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {backupConfigurationDatabaseAgentHosts?.data.map((databaseAgentHost) => (
          <DatabaseAgentHostRow key={databaseAgentHost.uuid} databaseAgentHost={databaseAgentHost} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
