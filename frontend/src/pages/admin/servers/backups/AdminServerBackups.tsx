import { useState } from 'react';
import { z } from 'zod';
import getServerBackups from '@/api/admin/servers/backups/getServerBackups.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminServerBackupRow from './AdminServerBackupRow.tsx';

export default function AdminServerBackups({ server }: { server: z.infer<typeof adminServerSchema> }) {
  const [showPartiallyDetachedServerBackups, setShowPartiallyDetachedServerBackups] = useState(false);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.servers.backups(server.uuid),
    fetcher: (page, search) => getServerBackups(server.uuid, page, search, showPartiallyDetachedServerBackups),
    deps: [showPartiallyDetachedServerBackups],
  });

  const serverBackups = data ?? getEmptyPaginationSet<z.infer<typeof adminNodeServerBackupSchema>>();

  return (
    <AdminSubContentContainer
      title='Server Backups'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Switch
          label='Only show partially detached backups'
          checked={showPartiallyDetachedServerBackups}
          onChange={(e) => setShowPartiallyDetachedServerBackups(e.currentTarget.checked)}
        />
      }
    >
      <ContextMenuProvider>
        <Table
          columns={['Name', 'Node', 'Checksum', 'Size', 'Files', 'Created', '']}
          loading={loading}
          pagination={serverBackups}
          onPageSelect={setPage}
        >
          {serverBackups.data.map((backup) => (
            <AdminServerBackupRow key={backup.uuid} backup={backup} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}
