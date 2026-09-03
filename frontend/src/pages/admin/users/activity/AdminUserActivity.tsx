import { z } from 'zod';
import getUserActivity from '@/api/admin/users/getUserActivity.ts';
import ActivityRow from '@/elements/activity/ActivityRow.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { activityColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminUserActivity({ user }: { user: z.infer<typeof adminFullUserSchema> }) {
  const { t } = useTranslations();

  const {
    data: userActivity,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.activity(user.uuid),
    fetcher: (page, search) => getUserActivity(user.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.users.tabs.activity.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.users.view.activity.subContainer}
      registryProps={{ user }}
    >
      <Table
        columns={activityColumns({ avatar: false })}
        loading={loading}
        error={error}
        pagination={userActivity}
        onPageSelect={setPage}
      >
        {userActivity?.data.map((activity, index) => (
          <ActivityRow key={`${activity.created.toISOString()}-${index}`} activity={activity} accountScoped />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
