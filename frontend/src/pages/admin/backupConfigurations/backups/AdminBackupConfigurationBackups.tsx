import { useState } from 'react';
import { z } from 'zod';
import getBackupConfigurationBackups from '@/api/admin/backup-configurations/backups/getBackupConfigurationBackups.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminBackupConfigurationBackupRow from './AdminBackupConfigurationBackupRow.tsx';

export default function AdminBackupConfigurationBackups({
  backupConfiguration,
}: {
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const [backupConfigurationBackups, setBackupConfigurationBackups] = useState<
    Pagination<z.infer<typeof adminNodeServerBackupSchema>>
  >(getEmptyPaginationSet());

  const { loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    fetcher: (page, search) => getBackupConfigurationBackups(backupConfiguration.uuid, page, search),
    setStoreData: setBackupConfigurationBackups,
  });

  return (
    <AdminSubContentContainer title={`Backup Config Backups`} titleOrder={2} search={search} setSearch={setSearch}>
      <ContextMenuProvider>
        <Table
          columns={['Name', 'Server', 'Node', 'Checksum', 'Size', 'Files', 'Created', '']}
          loading={loading}
          pagination={backupConfigurationBackups}
          onPageSelect={setPage}
        >
          {backupConfigurationBackups.data.map((backup) => (
            <AdminBackupConfigurationBackupRow key={backup.uuid} backup={backup} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}
