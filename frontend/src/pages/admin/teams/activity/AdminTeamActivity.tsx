import { z } from 'zod';
import getTeamActivity from '@/api/admin/teams/getTeamActivity.ts';
import ActivityRow from '@/elements/activity/ActivityRow.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { activityColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminTeamActivity({ team }: { team: z.infer<typeof adminTeamSchema> }) {
  const { t } = useTranslations();

  const {
    data: teamActivity,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.teams.activity(team.uuid),
    fetcher: (page, search, perPage) => getTeamActivity(team.uuid, page, search, perPage),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.teams.tabs.activity.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.teams.view.activity.subContainer}
      registryProps={{ team }}
    >
      <Table
        columns={activityColumns()}
        loading={loading}
        error={error}
        pagination={teamActivity}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
      >
        {teamActivity?.data.map((activity, index) => (
          <ActivityRow
            key={`${activity.created.toISOString()}-${index}`}
            activity={activity}
            showAvatar
            avatar={activity.user}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
