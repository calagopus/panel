import { faPlus, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { z } from 'zod';
import getTeamServers from '@/api/me/teams/servers/getTeamServers.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountSubContentContainer from '@/elements/containers/AccountSubContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import { isTeamOwner } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TeamServerAttachModal from './modals/TeamServerAttachModal.tsx';
import TeamServerActionBar from './TeamServerActionBar.tsx';
import TeamServerRow from './TeamServerRow.tsx';

export default function TeamServers({ team }: { team: z.infer<typeof userTeamSchema> }) {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'attach' | null>(null);

  const {
    data: servers,
    loading,
    error,
    search,
    debouncedSearch,
    setSearch,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.teams.servers(team.uuid),
    fetcher: (page, search, perPage) => getTeamServers(team.uuid, page, search, perPage),
  });

  const isOwner = isTeamOwner(team);

  const {
    selected: selectedServers,
    toggle: toggleServer,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: servers?.data, shortcuts: isOwner });

  const isEmpty = !loading && !error && !debouncedSearch && servers?.total === 0;

  const attachButton = (
    <Button onClick={() => setOpenModal('attach')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
      {t('pages.account.teams.tabs.servers.button.attach', {})}
    </Button>
  );

  return (
    <AccountSubContentContainer
      title={t('pages.account.teams.tabs.servers.title', {})}
      titleOrder={2}
      search={search}
      setSearch={isEmpty ? undefined : setSearch}
      contentRight={isEmpty || !isOwner ? undefined : attachButton}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.view.servers.subContainer}
      registryProps={{ team }}
    >
      <TeamServerAttachModal team={team} opened={openModal === 'attach'} onClose={() => setOpenModal(null)} />

      <TeamServerActionBar
        team={team}
        selectedServers={selectedServers}
        clearSelection={clearSelection}
        onFinished={refetch}
      />

      <SelectionArea {...selectionAreaProps} disabled={!isOwner}>
        <Table
          columns={[
            ...(isOwner
              ? [
                  tableSelectionHeader({
                    checked: allSelected,
                    indeterminate: selectedServers.size > 0 && !allSelected,
                    onChange: (checked) => (checked ? selectAll() : clearSelection()),
                  }),
                ]
              : []),
            t('common.table.columns.name', {}),
            t('common.table.columns.egg', {}),
            t('common.table.columns.location', {}),
            '',
          ]}
          loading={loading}
          pagination={servers}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
          empty={
            debouncedSearch ? undefined : (
              <EmptyState
                flush
                icon={faServer}
                title={t('pages.account.teams.tabs.servers.empty.title', {})}
                description={
                  isOwner
                    ? t('pages.account.teams.tabs.servers.empty.description', {})
                    : t('pages.account.teams.tabs.servers.empty.descriptionReadOnly', {})
                }
              >
                {isOwner && attachButton}
              </EmptyState>
            )
          }
        >
          {servers?.data.map((server) => (
            <SelectionArea.Selectable key={server.uuid} item={server}>
              {(innerRef: Ref<HTMLElement>) => (
                <TeamServerRow
                  team={team}
                  server={server}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedServers.has(server.uuid)}
                  onSelectionChange={isOwner ? (selected, range) => toggleServer(server, selected, range) : undefined}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AccountSubContentContainer>
  );
}
