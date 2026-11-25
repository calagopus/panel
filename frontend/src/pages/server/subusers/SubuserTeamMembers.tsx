import { faLock, faLockOpen, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import getSubuserTeamMembers from '@/api/server/subusers/getSubuserTeamMembers.ts';
import Avatar from '@/elements/data-display/Avatar.tsx';
import Table, { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function SubuserTeamMembers() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const {
    data: members,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).subusers.team(),
    fetcher: (page, search, perPage) => getSubuserTeamMembers(server.uuid, page, search, perPage),
  });

  return (
    <Stack mt='xl'>
      <Group justify='space-between'>
        <div>
          <Title order={2}>{t('pages.server.subusers.team.title', {})}</Title>
          <Text size='xs' c='dimmed'>
            {t('pages.server.subusers.team.subtitle', {})}
          </Text>
        </div>
        <TextInput
          placeholder={t('common.input.search', {})}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<FontAwesomeIcon icon={faSearch} />}
          w={250}
        />
      </Group>

      <Table
        columns={[
          '',
          t('common.table.columns.username', {}),
          t('pages.server.subusers.table.columns.twoFactorEnabled', {}),
          t('pages.account.teams.table.columns.preset', {}),
          t('pages.server.subusers.table.columns.permissions', {}),
          t('pages.server.subusers.table.columns.ignoredFiles', {}),
        ]}
        loading={loading}
        pagination={members}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {members?.data.map((member) => (
          <TableRow key={member.user.uuid}>
            <TableData>
              <div className='size-5 aspect-square relative'>
                <Avatar size={20} className='select-none' src={member.user.avatar} name={member.user.username} />
              </div>
            </TableData>

            <TableData>{member.user.username}</TableData>

            <TableData>
              {member.user.totpEnabled ? (
                <FontAwesomeIcon className='text-(--mantine-color-green-text)' icon={faLock} />
              ) : (
                <FontAwesomeIcon className='text-(--mantine-color-red-text)' icon={faLockOpen} />
              )}
            </TableData>

            <TableData>{member.preset.name}</TableData>

            <TableData>{member.preset.permissions.length}</TableData>

            <TableData>{member.preset.ignoredFiles.length}</TableData>
          </TableRow>
        ))}
      </Table>
    </Stack>
  );
}
