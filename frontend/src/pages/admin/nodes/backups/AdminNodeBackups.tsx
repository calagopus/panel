import { useState } from 'react';
import { z } from 'zod';
import getNodeBackups from '@/api/admin/nodes/backups/getNodeBackups.ts';

import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeBackupRow from './NodeBackupRow.tsx';

export default function AdminNodeBackups({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const [showDetachedNodeBackups, setShowDetachedNodeBackups] = useState(false);

  const {
    data: nodeBackups,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.backups(node.uuid),
    fetcher: (page, search) => getNodeBackups(node.uuid, page, search, showDetachedNodeBackups),
    deps: [showDetachedNodeBackups],
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.backups.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Switch
          label={t('pages.admin.nodes.tabs.backups.page.input.detachedOnly', {})}
          checked={showDetachedNodeBackups}
          onChange={(e) => setShowDetachedNodeBackups(e.currentTarget.checked)}
        />
      }
    >
      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('common.table.columns.server', {}),
          t('common.table.columns.checksum', {}),
          t('common.table.columns.size', {}),
          t('common.table.columns.files', {}),
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        pagination={nodeBackups}
        onPageSelect={setPage}
      >
        {nodeBackups?.data.map((backup) => (
          <NodeBackupRow key={backup.uuid} node={node} backup={backup} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
