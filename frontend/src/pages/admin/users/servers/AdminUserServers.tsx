import { useState } from 'react';
import { z } from 'zod';
import getUserServers from '@/api/admin/users/servers/getUserServers.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import ServerRow from '@/pages/admin/servers/ServerRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';

export default function AdminUserServers({ user }: { user: z.infer<typeof fullUserSchema> }) {
  const [showOwnedUserServers, setShowOwnedUserServers] = useState(false);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.servers(user.uuid),
    fetcher: (page, search) => getUserServers(user.uuid, page, search, showOwnedUserServers),
    deps: [showOwnedUserServers],
  });

  const userServers = data ?? getEmptyPaginationSet<z.infer<typeof adminServerSchema>>();

  return (
    <AdminSubContentContainer
      title='User Servers'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Switch
          label="Only show users' owned servers"
          checked={showOwnedUserServers}
          onChange={(e) => setShowOwnedUserServers(e.currentTarget.checked)}
        />
      }
    >
      <Table columns={serverTableColumns} loading={loading} pagination={userServers} onPageSelect={setPage}>
        {userServers.data.map((server) => (
          <ServerRow key={server.uuid} server={server} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
