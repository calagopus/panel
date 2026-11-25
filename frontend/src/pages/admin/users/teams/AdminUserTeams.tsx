import { z } from 'zod';
import getUserTeams from '@/api/admin/users/teams/getUserTeams.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { adminUserTeamTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import UserTeamRow from './UserTeamRow.tsx';

export default function AdminUserTeams({ user }: { user: z.infer<typeof adminFullUserSchema> }) {
  const { t } = useTranslations();

  const {
    data: userTeams,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.teams.byUser(user.uuid),
    fetcher: (page, search, perPage) => getUserTeams(user.uuid, page, search, perPage),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.users.tabs.teams.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.users.view.teams.subContainer}
      registryProps={{ user }}
    >
      <Table
        columns={adminUserTeamTableColumns()}
        loading={loading}
        pagination={userTeams}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {userTeams?.data.map((team) => (
          <UserTeamRow key={team.uuid} team={team} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
