import getAdminActivity from '@/api/admin/getAdminActivity.ts';
import ActivityRow from '@/elements/activity/ActivityRow.tsx';
import ClearUserFilterButton from '@/elements/activity/ClearUserFilterButton.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { activityColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useUserFilter } from '@/plugins/useUserFilter.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminActivity() {
  const { t } = useTranslations();
  const { filterUserUuid, setFilterUserUuid } = useUserFilter();

  const {
    data: activities,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.activity.all(filterUserUuid),
    fetcher: (page, search) => getAdminActivity(filterUserUuid, page, search),
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.activity.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={filterUserUuid ? <ClearUserFilterButton onClick={() => setFilterUserUuid(null)} /> : null}
      registry={window.extensionContext.extensionRegistry.pages.admin.activity.container}
    >
      <Table columns={activityColumns()} loading={loading} error={error} pagination={activities} onPageSelect={setPage}>
        {activities?.data.map((activity, index) => (
          <ActivityRow
            key={`${activity.created.toISOString()}-${index}`}
            activity={activity}
            showAvatar
            avatar={activity.user}
            linkActor
          />
        ))}
      </Table>
    </AdminContentContainer>
  );
}
