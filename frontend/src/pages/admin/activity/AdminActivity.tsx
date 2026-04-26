import getAdminActivity from '@/api/admin/getAdminActivity.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminActivityColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import ActivityRow from './ActivityRow.tsx';

export default function AdminActivity() {
  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.activity.all(),
    fetcher: getAdminActivity,
  });

  const activities = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminContentContainer title='Activity' search={search} setSearch={setSearch}>
      <Table columns={adminActivityColumns} loading={loading} pagination={activities} onPageSelect={setPage}>
        {activities.data.map((activity) => (
          <ActivityRow key={activity.created.toString()} activity={activity} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}
