import { useState } from 'react';
import { z } from 'zod';
import getNodeBackups from '@/api/admin/nodes/backups/getNodeBackups.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import NodeBackupRow from './NodeBackupRow.tsx';

export default function AdminNodeBackups({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const [showDetachedNodeBackups, setShowDetachedNodeBackups] = useState(false);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.backups(node.uuid),
    fetcher: (page, search) => getNodeBackups(node.uuid, page, search, showDetachedNodeBackups),
    deps: [showDetachedNodeBackups],
  });

  const nodeBackups = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminSubContentContainer
      title='Node Backups'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Switch
          label='Only show detached backups'
          checked={showDetachedNodeBackups}
          onChange={(e) => setShowDetachedNodeBackups(e.currentTarget.checked)}
        />
      }
    >
      <ContextMenuProvider>
        <Table
          columns={['Name', 'Server', 'Checksum', 'Size', 'Files', 'Created', '']}
          loading={loading}
          pagination={nodeBackups}
          onPageSelect={setPage}
        >
          {nodeBackups.data.map((backup) => (
            <NodeBackupRow key={backup.uuid} node={node} backup={backup} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}
