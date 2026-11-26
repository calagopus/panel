import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getTeams from '@/api/admin/teams/getTeams.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { teamTableColumns } from '@/lib/tableColumns.ts';
import TeamCreateOrUpdate from '@/pages/admin/teams/TeamCreateOrUpdate.tsx';
import TeamLookupPopover from '@/pages/admin/teams/TeamLookupPopover.tsx';
import TeamRow from '@/pages/admin/teams/TeamRow.tsx';
import TeamView from '@/pages/admin/teams/TeamView.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';

function TeamsContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();

  const {
    data: teams,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.teams.all(),
    fetcher: getTeams,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.teams.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.admin.teams.container}
      search={search}
      setSearch={setSearch}
      contentRight={
        <>
          <TeamLookupPopover />
          <AdminCan action='teams.create'>
            <Button
              onClick={() => navigate('/admin/teams/new')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.create', {})}
            </Button>
          </AdminCan>
        </>
      }
    >
      <Table
        columns={teamTableColumns()}
        loading={loading}
        pagination={teams}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {teams?.data.map((team) => (
          <TeamRow key={team.uuid} team={team} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminTeams() {
  return (
    <Routes>
      <Route path='/' element={<TeamsContainer />} />
      <Route path='/:id/*' element={<TeamView />} />
      <Route element={<AdminPermissionGuard permission='teams.create' />}>
        <Route path='/new' element={<TeamCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
