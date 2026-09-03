import { faCodeBranch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { NavLink, useSearchParams } from 'react-router';
import getServerActivity from '@/api/server/getServerActivity.ts';
import ActivityRow from '@/elements/activity/ActivityRow.tsx';
import ClearUserFilterButton from '@/elements/activity/ClearUserFilterButton.tsx';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { activityColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useUserFilter } from '@/plugins/useUserFilter.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerActivity() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const [searchParams] = useSearchParams();
  const { filterUserUuid, setFilterUserUuid } = useUserFilter();

  const {
    data: activities,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).activity.all(filterUserUuid),
    fetcher: (page, search) => getServerActivity(server.uuid, filterUserUuid, page, search),
  });

  return (
    <ServerContentContainer
      title={t('pages.server.activity.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={filterUserUuid ? <ClearUserFilterButton onClick={() => setFilterUserUuid(null)} /> : null}
      registry={window.extensionContext.extensionRegistry.pages.server.activity.container}
    >
      <Table columns={activityColumns()} loading={loading} pagination={activities} onPageSelect={setPage} error={error}>
        {activities?.data.map((activity, index) => {
          const fileWriteData = activity.data as { file?: string; revision_id?: string } | null;
          const diffHref =
            activity.event === 'server:file.write' && fileWriteData?.file && fileWriteData?.revision_id
              ? `/server/${server.uuidShort}/files/diff?file=${encodeURIComponent(fileWriteData.file)}&revision=${fileWriteData.revision_id}`
              : null;

          return (
            <ActivityRow
              key={`${activity.created.toISOString()}-${index}`}
              activity={activity}
              showAvatar
              avatar={activity.user}
              linkActor
              actions={
                diffHref ? (
                  <NavLink
                    to={diffHref}
                    state={{
                      backTo: `/server/${server.uuidShort}/activity${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`,
                    }}
                  >
                    <ActionIcon>
                      <FontAwesomeIcon icon={faCodeBranch} />
                    </ActionIcon>
                  </NavLink>
                ) : null
              }
            />
          );
        })}
      </Table>
    </ServerContentContainer>
  );
}
