import { Group } from '@mantine/core';
import { z } from 'zod';
import getUserActivity from '@/api/admin/users/getUserActivity.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import ActivityInfoButton from '@/elements/activity/ActivityInfoButton.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table, { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userActivitySchema } from '@/lib/schemas/user/activity.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminUserActivity({ user }: { user: z.infer<typeof fullUserSchema> }) {
  const { t } = useTranslations();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.activity(user.uuid),
    fetcher: (page, search) => getUserActivity(user.uuid, page, search),
  });

  const userActivity = data ?? getEmptyPaginationSet<z.infer<typeof userActivitySchema>>();

  return (
    <AdminSubContentContainer title='User Activity' titleOrder={2} search={search} setSearch={setSearch}>
      <Table
        columns={['Actor', 'Event', 'IP', 'When', '']}
        loading={loading}
        pagination={userActivity}
        onPageSelect={setPage}
      >
        {userActivity.data.map((activity) => (
          <TableRow key={activity.created.toString()}>
            <TableData>{activity.isApi ? 'API' : 'Web'}</TableData>

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
    </AdminSubContentContainer>
  );
}
