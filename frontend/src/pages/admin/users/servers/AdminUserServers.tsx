import { useState } from 'react';
import { z } from 'zod';
import getUserServers from '@/api/admin/users/servers/getUserServers.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import ServerRow from '@/pages/admin/servers/ServerRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminUserServers({ user }: { user: z.infer<typeof fullUserSchema> }) {
  const { t } = useTranslations();
  const [showOwnedUserServers, setShowOwnedUserServers] = useState(false);

  const {
    data: userServers,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.servers(user.uuid),
    fetcher: (page, search) => getUserServers(user.uuid, page, search, showOwnedUserServers),
    deps: [showOwnedUserServers],
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.users.tabs.servers.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Switch
          label={t('pages.admin.users.tabs.servers.page.showOwnedOnly', {})}
          checked={showOwnedUserServers}
          onChange={(e) => setShowOwnedUserServers(e.currentTarget.checked)}
        />
      }
    >
      <Table columns={serverTableColumns()} loading={loading} pagination={userServers} onPageSelect={setPage}>
        {userServers?.data.map((server) => (
          <ServerRow key={server.uuid} server={server} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
