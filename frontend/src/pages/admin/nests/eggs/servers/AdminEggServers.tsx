import { z } from 'zod';
import getEggServers from '@/api/admin/nests/eggs/servers/getEggServers.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import ServerRow from '@/pages/admin/servers/ServerRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';

export default function AdminEggServers({
  contextNest,
  contextEgg,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg: z.infer<typeof adminEggSchema>;
}) {
  const {
    data: eggServers,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.eggs.servers(contextEgg.uuid),
    fetcher: (page, search) => getEggServers(contextNest.uuid, contextEgg.uuid, page, search),
  });

  return (
    <AdminSubContentContainer title='Egg Servers' titleOrder={2} search={search} setSearch={setSearch}>
      <Table columns={serverTableColumns} loading={loading} pagination={eggServers} onPageSelect={setPage}>
        {eggServers?.data.map((server) => (
          <ServerRow key={server.uuid} server={server} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
