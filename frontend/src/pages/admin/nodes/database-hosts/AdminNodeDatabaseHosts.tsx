import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getNodeDatabaseHosts from '@/api/admin/nodes/database-hosts/getNodeDatabaseHosts.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeDatabaseHostTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeDatabaseHostCreateModal from './modals/NodeDatabaseHostCreateModal.tsx';
import NodeDatabaseHostRow from './NodeDatabaseHostRow.tsx';

export default function AdminNodeDatabaseHosts({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: nodeDatabaseHosts,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.databaseHosts(node.uuid),
    fetcher: (page, search) => getNodeDatabaseHosts(node.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.databaseHosts.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.databaseHosts.subContainer}
      registryProps={{ node }}
      contentRight={
        <AdminCan action='database-hosts.read'>
          <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action='database-hosts.read'>
        <NodeDatabaseHostCreateModal node={node} opened={openModal === 'create'} onClose={() => setOpenModal(null)} />
      </AdminCan>

      <Table
        columns={nodeDatabaseHostTableColumns()}
        loading={loading}
        error={error}
        pagination={nodeDatabaseHosts}
        onPageSelect={setPage}
      >
        {nodeDatabaseHosts?.data.map((databaseHost) => (
          <NodeDatabaseHostRow key={databaseHost.databaseHost.uuid} node={node} databaseHost={databaseHost} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
