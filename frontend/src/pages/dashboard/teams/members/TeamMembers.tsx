import { faPlus, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { z } from 'zod';
import getTeamMembers from '@/api/me/teams/members/getTeamMembers.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountSubContentContainer from '@/elements/containers/AccountSubContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { canManageTeamMembers } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import TeamMemberCreateModal from './modals/TeamMemberCreateModal.tsx';
import TeamMemberActionBar from './TeamMemberActionBar.tsx';
import TeamMemberRow from './TeamMemberRow.tsx';

export default function TeamMembers({ team }: { team: z.infer<typeof userTeamSchema> }) {
  const { t, tItem } = useTranslations();
  const maxTeamMemberCount = useGlobalStore((state) => state.settings.user.maxTeamMemberCount);

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: members,
    loading,
    error,
    search,
    debouncedSearch,
    setSearch,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.teams.members(team.uuid),
    fetcher: (page, search, perPage) => getTeamMembers(team.uuid, page, search, perPage),
  });

  const canManage = canManageTeamMembers(team);

  const {
    selected: selectedMembers,
    toggle: toggleMember,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({
    items: members?.data,
    identify: (member) => member.user.uuid,
    shortcuts: canManage,
  });

  const atLimit = (members?.total ?? 0) >= maxTeamMemberCount;
  const isEmpty = !loading && !error && !debouncedSearch && members?.total === 0;

  const inviteButton = (
    <ConditionalTooltip
      enabled={atLimit}
      label={t('common.tooltip.limitReached.team', { items: tItem('teamMember', maxTeamMemberCount) })}
    >
      <Button
        onClick={() => setOpenModal('create')}
        color='blue'
        leftSection={<FontAwesomeIcon icon={faPlus} />}
        disabled={!members || atLimit}
      >
        {t('pages.account.teams.tabs.members.button.invite', {})}
      </Button>
    </ConditionalTooltip>
  );

  return (
    <AccountSubContentContainer
      title={t('pages.account.teams.tabs.members.title', {})}
      subtitle={t('common.label.limitUsage.invited', {
        current: members?.total ?? '...',
        max: maxTeamMemberCount,
      })}
      titleOrder={2}
      search={search}
      setSearch={isEmpty ? undefined : setSearch}
      contentRight={isEmpty ? undefined : inviteButton}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.view.members.subContainer}
      registryProps={{ team }}
    >
      <TeamMemberCreateModal team={team} opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <TeamMemberActionBar
        team={team}
        selectedMembers={selectedMembers}
        clearSelection={clearSelection}
        onFinished={refetch}
      />

      <SelectionArea {...selectionAreaProps} disabled={!canManage}>
        <Table
          columns={[
            ...(canManage
              ? [
                  tableSelectionHeader({
                    checked: allSelected,
                    indeterminate: selectedMembers.size > 0 && !allSelected,
                    onChange: (checked) => (checked ? selectAll() : clearSelection()),
                  }),
                ]
              : []),
            '',
            t('common.table.columns.username', {}),
            t('pages.account.teams.table.columns.preset', {}),
            t('pages.account.teams.table.columns.management', {}),
            t('pages.server.subusers.table.columns.twoFactorEnabled', {}),
            t('pages.account.teams.table.columns.joined', {}),
            '',
          ]}
          loading={loading}
          pagination={members}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
          empty={
            debouncedSearch ? undefined : (
              <EmptyState
                flush
                icon={faUsers}
                title={t('pages.account.teams.tabs.members.empty.title', {})}
                description={t('pages.account.teams.tabs.members.empty.description', {})}
              >
                {inviteButton}
              </EmptyState>
            )
          }
        >
          {members?.data.map((member) => (
            <SelectionArea.Selectable key={member.user.uuid} item={member}>
              {(innerRef: Ref<HTMLElement>) => (
                <TeamMemberRow
                  team={team}
                  member={member}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedMembers.has(member.user.uuid)}
                  onSelectionChange={canManage ? (selected, range) => toggleMember(member, selected, range) : undefined}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AccountSubContentContainer>
  );
}
