import { z } from 'zod';
import getTeamActivity from '@/api/me/teams/getTeamActivity.ts';
import ActivityRow from '@/elements/activity/ActivityRow.tsx';
import AccountSubContentContainer from '@/elements/containers/AccountSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { activityColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TeamActivity({ team }: { team: z.infer<typeof userTeamSchema> }) {
  const { t } = useTranslations();

  const {
    data: activities,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.teams.activity(team.uuid),
    fetcher: (page, search, perPage) => getTeamActivity(team.uuid, page, search, perPage),
  });

  return (
    <AccountSubContentContainer
      title={t('pages.account.teams.tabs.activity.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.view.activity.subContainer}
      registryProps={{ team }}
    >
      <Table
        columns={activityColumns()}
        loading={loading}
        pagination={activities}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {activities?.data.map((activity, index) => (
          <ActivityRow
            key={`${activity.created.toISOString()}-${index}`}
            activity={activity}
            showAvatar
            avatar={activity.user}
          />
        ))}
      </Table>
    </AccountSubContentContainer>
  );
}
