import { useState } from 'react';
import { z } from 'zod';
import deleteFailedNodeBackups from '@/api/admin/nodes/backups/deleteFailedNodeBackups.ts';
import getNodeBackups from '@/api/admin/nodes/backups/getNodeBackups.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Group from '@/elements/layout/Group.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DeleteFailedBackupsButton from './DeleteFailedBackupsButton.tsx';
import NodeBackupRow from './NodeBackupRow.tsx';

export default function AdminNodeBackups({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const [showDetachedNodeBackups, setShowDetachedNodeBackups] = useState(false);

  const {
    data: nodeBackups,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backups.byNode(node.uuid),
    fetcher: (page, search) => getNodeBackups(node.uuid, page, search, showDetachedNodeBackups),
    paginationKey: 'backups',
    deps: [showDetachedNodeBackups],
    refetchInterval: (data) =>
      data?.backups.data.some((backup) => backup.deletionStatus === 'deleting') ? 5000 : false,
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.backups.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.backups.subContainer}
      registryProps={{ node }}
      contentRight={
        <Group>
          <Switch
            label={t('pages.admin.nodes.tabs.backups.page.input.detachedOnly', {})}
            checked={showDetachedNodeBackups}
            onChange={(e) => setShowDetachedNodeBackups(e.currentTarget.checked)}
          />

          <DeleteFailedBackupsButton
            failed={nodeBackups?.failed ?? 0}
            onDelete={(force) => deleteFailedNodeBackups(node.uuid, { detached: showDetachedNodeBackups, force })}
          />
        </Group>
      }
    >
      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('pages.server.backups.table.columns.kind', {}),
          t('common.table.columns.source', {}),
          t('common.table.columns.server', {}),
          t('common.table.columns.checksum', {}),
          t('common.table.columns.size', {}),
          t('common.table.columns.files', {}),
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        error={error}
        pagination={nodeBackups?.backups}
        onPageSelect={setPage}
      >
        {nodeBackups?.backups.data.map((backup) => (
          <NodeBackupRow key={backup.uuid} node={node} backup={backup} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
