import { z } from 'zod';
import getMountServers from '@/api/admin/mounts/servers/getMountServers.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import ServerRow from '../../servers/ServerRow.tsx';

export default function AdminMountServers({ mount }: { mount: z.infer<typeof adminMountSchema> }) {
  const {
    data: mountServers,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.mounts.servers(mount.uuid),
    fetcher: (page, search) => getMountServers(mount.uuid, page, search),
  });

  return (
    <AdminSubContentContainer title='Mount Servers' titleOrder={2} search={search} setSearch={setSearch}>
      <Table columns={serverTableColumns} loading={loading} pagination={mountServers} onPageSelect={setPage}>
        {mountServers?.data.map((serverMount) => (
          <ServerRow key={serverMount.server.uuid} server={serverMount.server} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
