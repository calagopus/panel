import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getNodeDatabaseAgentHosts from '@/api/admin/nodes/database-agent-hosts/getNodeDatabaseAgentHosts.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeDatabaseAgentHostTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeDatabaseAgentHostCreateModal from './modals/NodeDatabaseAgentHostCreateModal.tsx';
import NodeDatabaseAgentHostRow from './NodeDatabaseAgentHostRow.tsx';

export default function AdminNodeDatabaseAgentHosts({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: nodeDatabaseAgentHosts,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.databaseAgentHosts(node.uuid),
    fetcher: (page, search) => getNodeDatabaseAgentHosts(node.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.databaseAgentHosts.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.databaseAgentHosts.subContainer}
      registryProps={{ node }}
      contentRight={
        <AdminCan action='database-agent-hosts.read'>
          <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action='database-agent-hosts.read'>
        <NodeDatabaseAgentHostCreateModal
          node={node}
          opened={openModal === 'create'}
          onClose={() => setOpenModal(null)}
        />
      </AdminCan>

      <Table
        columns={nodeDatabaseAgentHostTableColumns()}
        loading={loading}
        error={error}
        pagination={nodeDatabaseAgentHosts}
        onPageSelect={setPage}
      >
        {nodeDatabaseAgentHosts?.data.map((databaseAgentHost) => (
          <NodeDatabaseAgentHostRow
            key={databaseAgentHost.databaseAgentHost.uuid}
            node={node}
            databaseAgentHost={databaseAgentHost}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
