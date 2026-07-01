import { useState } from 'react';
import { z } from 'zod';
import getServerBackups from '@/api/admin/servers/backups/getServerBackups.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminServerBackupRow from './AdminServerBackupRow.tsx';

export default function AdminServerBackups({ server }: { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const [showPartiallyDetachedServerBackups, setShowPartiallyDetachedServerBackups] = useState(false);

  const {
    data: serverBackups,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.servers.backups(server.uuid),
    fetcher: (page, search) => getServerBackups(server.uuid, page, search, showPartiallyDetachedServerBackups),
    deps: [showPartiallyDetachedServerBackups],
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.backups.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Switch
          label={t('pages.admin.servers.tabs.backups.page.input.partiallyDetachedOnly', {})}
          checked={showPartiallyDetachedServerBackups}
          onChange={(e) => setShowPartiallyDetachedServerBackups(e.currentTarget.checked)}
        />
      }
    >
      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('common.table.columns.node', {}),
          t('common.table.columns.checksum', {}),
          t('common.table.columns.size', {}),
          t('common.table.columns.files', {}),
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        pagination={serverBackups}
        onPageSelect={setPage}
      >
        {serverBackups?.data.map((backup) => (
          <AdminServerBackupRow key={backup.uuid} backup={backup} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
