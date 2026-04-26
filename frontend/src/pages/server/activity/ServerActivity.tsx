import { Group } from '@mantine/core';
import { z } from 'zod';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getServerActivity from '@/api/server/getServerActivity.ts';
import ActivityInfoButton from '@/elements/activity/ActivityInfoButton.tsx';
import Code from '@/elements/Code.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table, { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverActivitySchema } from '@/lib/schemas/server/activity.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerActivity() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).activity.all(),
    fetcher: (page, search) => getServerActivity(server.uuid, page, search),
  });

  const activities = data ?? getEmptyPaginationSet<z.infer<typeof serverActivitySchema>>();

  return (
    <ServerContentContainer
      title={t('pages.server.activity.title', {})}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.server.activity.container}
    >
      <Table
        columns={[
          '',
          t('common.table.columns.actor', {}),
          t('common.table.columns.event', {}),
          t('common.table.columns.ip', {}),
          t('common.table.columns.when', {}),
          '',
        ]}
        loading={loading}
        pagination={activities}
        onPageSelect={setPage}
      >
        {activities.data.map((activity) => (
          <TableRow key={activity.created.toString()}>
            <TableData>
              <div className='size-5 aspect-square relative'>
                <img
                  src={activity.user?.avatar ?? '/icon.svg'}
                  alt={activity.user?.username}
                  className='size-5 object-cover rounded-full select-none'
                />
              </div>
            </TableData>

            <TableData>
              {activity.user
                ? `${activity.user.username} (${activity.isApi ? t('common.api', {}) : t('common.web', {})})`
                : activity.isSchedule
                  ? t('common.schedule', {})
                  : t('common.system', {})}
              {activity.impersonator &&
                ` (${t('common.impersonatedBy', { username: activity.impersonator.username })})`}
            </TableData>

            <TableData>
              <Code>{activity.event}</Code>
            </TableData>

            <TableData>
              <Code>{activity.ip ? activity.ip : t('common.na', {})}</Code>
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={activity.created} />
            </TableData>

            <TableData>
              <Group gap={4} justify='right' wrap='nowrap'>
                {Object.keys(activity.data ?? {}).length > 0 ? <ActivityInfoButton activity={activity} /> : null}
              </Group>
            </TableData>
          </TableRow>
        ))}
      </Table>
    </ServerContentContainer>
  );
}
