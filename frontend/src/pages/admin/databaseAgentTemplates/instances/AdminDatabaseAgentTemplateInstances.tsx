import { z } from 'zod';
import getDatabaseAgentTemplateInstances from '@/api/admin/database-agent-templates/getDatabaseAgentTemplateInstances.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentTemplateSchema } from '@/lib/schemas/admin/databaseAgentTemplates.ts';
import { databaseAgentTemplateInstanceTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseAgentRow from './DatabaseAgentRow.tsx';

export default function AdminDatabaseAgentTemplateInstances({
  databaseAgentTemplate,
}: {
  databaseAgentTemplate: z.infer<typeof adminDatabaseAgentTemplateSchema>;
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
    queryKey: queryKeys.admin.databaseAgentTemplates.instances(databaseAgentTemplate.uuid),
    fetcher: (page, search) => getDatabaseAgentTemplateInstances(databaseAgentTemplate.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseAgentTemplates.tabs.instances.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
    >
      <Table
        columns={databaseAgentTemplateInstanceTableColumns()}
        loading={loading}
        error={error}
        pagination={instances}
        onPageSelect={setPage}
      >
        {instances?.data.map((databaseAgent) => (
          <DatabaseAgentRow key={databaseAgent.uuid} databaseAgent={databaseAgent} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
