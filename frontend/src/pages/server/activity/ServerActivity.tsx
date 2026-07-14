import { faCodeBranch, faX } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router';
import getServerActivity from '@/api/server/getServerActivity.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Avatar from '@/elements/Avatar.tsx';
import ActivityInfoButton from '@/elements/activity/ActivityInfoButton.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import Table, { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerActivity() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const [searchParams, setSearchParams] = useSearchParams();

  const [filterUserUuid, setFilterUserUuid] = useState<string | null>(null);

  useEffect(() => {
    if (filterUserUuid) {
      setSearchParams((prev) => {
        prev.set('user', filterUserUuid);
        return prev;
      });
    } else {
      setSearchParams((prev) => {
        prev.delete('user');
        return prev;
      });
    }
  }, [filterUserUuid, setSearchParams]);

  useEffect(() => {
    const userUuid = searchParams.get('user');
    if (userUuid) {
      setFilterUserUuid(userUuid);
    }
  }, [searchParams, setSearchParams]);

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
      contentRight={
        filterUserUuid ? (
          <Button onClick={() => setFilterUserUuid(null)} color='gray' leftSection={<FontAwesomeIcon icon={faX} />}>
            {t('pages.server.activity.button.clearUserFilter', {})}
          </Button>
        ) : null
      }
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
        error={error}
      >
        {activities?.data.map((activity, index) => {
          const fileWriteData = activity.data as { file?: string; revision_id?: string } | null;

          return (
            <TableRow key={`${activity.created.toISOString()}-${index}`}>
              <TableData>
                <Avatar size={20} className='select-none' src={activity.user?.avatar} name={activity.user?.username} />
              </TableData>

              <TableData>
                {activity.user ? (
                  <>
                    <TableLink to={{ search: `?${searchParams.toString()}&user=${activity.user.uuid}` }}>
                      {activity.user.username}
                    </TableLink>{' '}
                    ({activity.isApi ? t('common.api', {}) : t('common.web', {})})
                  </>
                ) : activity.isSchedule ? (
                  t('common.schedule', {})
                ) : (
                  t('common.system', {})
                )}
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
                  {activity.event === 'server:file.write' && fileWriteData?.file && fileWriteData?.revision_id ? (
                    <NavLink
                      to={`/server/${server.uuidShort}/files/diff?file=${encodeURIComponent(fileWriteData.file)}&revision=${fileWriteData.revision_id}`}
                    >
                      <ActionIcon>
                        <FontAwesomeIcon icon={faCodeBranch} />
                      </ActionIcon>
                    </NavLink>
                  ) : null}
                  {Object.keys(activity.data ?? {}).length > 0 ? <ActivityInfoButton activity={activity} /> : null}
                </Group>
              </TableData>
            </TableRow>
          );
        })}
      </Table>
    </ServerContentContainer>
  );
}
