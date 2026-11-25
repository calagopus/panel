import { faPeopleGroup, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import getTeams from '@/api/me/teams/getTeams.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { dashboardTeamTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import TeamCreateModal from './modals/TeamCreateModal.tsx';
import TeamRow from './TeamRow.tsx';

export default function DashboardTeams() {
  const { t } = useTranslations();
  const settings = useGlobalStore((state) => state.settings);

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: teams,
    loading,
    error,
    search,
    debouncedSearch,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.teams.all(),
    fetcher: getTeams,
  });

  const isEmpty = !loading && !error && !debouncedSearch && teams?.total === 0;

  const createButton = (label: string) => (
    <Button
      onClick={() => setOpenModal('create')}
      color='blue'
      leftSection={<FontAwesomeIcon icon={faPlus} />}
      disabled={!teams}
    >
      {label}
    </Button>
  );

  return (
    <AccountContentContainer
      title={t('pages.account.teams.title', {})}
      subtitle={t('pages.account.teams.subtitle', {})}
      search={search}
      setSearch={isEmpty ? undefined : setSearch}
      contentRight={
        isEmpty || !settings.user.allowCreatingTeams ? undefined : createButton(t('common.button.create', {}))
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.container}
    >
      <TeamCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <Table
        columns={dashboardTeamTableColumns()}
        loading={loading}
        pagination={teams}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
        empty={
          debouncedSearch ? undefined : (
            <EmptyState
              flush
              icon={faPeopleGroup}
              title={t('pages.account.teams.empty.title', {})}
              description={
                settings.user.allowCreatingTeams
                  ? t('pages.account.teams.empty.description', {})
                  : t('pages.account.teams.empty.descriptionReadOnly', {})
              }
            >
              {settings.user.allowCreatingTeams && createButton(t('pages.account.teams.button.createFirstTeam', {}))}
            </EmptyState>
          )
        }
      >
        {teams?.data.map((team) => (
          <TeamRow key={team.uuid} team={team} />
        ))}
      </Table>
    </AccountContentContainer>
  );
}
