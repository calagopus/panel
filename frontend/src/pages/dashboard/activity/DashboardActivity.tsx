import { Group } from '@mantine/core';
import { z } from 'zod';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getUserActivity from '@/api/me/getUserActivity.ts';
import ActivityInfoButton from '@/elements/activity/ActivityInfoButton.tsx';
import Code from '@/elements/Code.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table, { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userActivitySchema } from '@/lib/schemas/user/activity.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DashboardActivity() {
  const { user } = useAuth();
  const { t } = useTranslations();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.activity.all(),
    fetcher: getUserActivity,
  });

  const activities = data ?? getEmptyPaginationSet<z.infer<typeof userActivitySchema>>();

  return (
    <AccountContentContainer
      title={t('pages.account.activity.title', {})}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.activity.container}
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
                  src={(activity.impersonator ?? user)?.avatar ?? '/icon.svg'}
                  alt={(activity.impersonator ?? user)?.username}
                  className='size-5 object-cover rounded-full select-none'
                />
              </div>
            </TableData>

            <TableData>
              {activity.impersonator
                ? `${t('common.impersonatedBy', { username: activity.impersonator.username })} (${activity.isApi ? t('common.api', {}) : t('common.web', {})})`
                : activity.isApi
                  ? t('common.api', {})
                  : t('common.web', {})}
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
    </AccountContentContainer>
  );
}
