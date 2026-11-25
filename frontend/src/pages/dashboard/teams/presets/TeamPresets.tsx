import { faIdBadge, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { z } from 'zod';
import getTeamPresets from '@/api/me/teams/presets/getTeamPresets.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountSubContentContainer from '@/elements/containers/AccountSubContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { canManageTeamPresets } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import TeamPresetCreateModal from './modals/TeamPresetCreateModal.tsx';
import TeamPresetActionBar from './TeamPresetActionBar.tsx';
import TeamPresetRow from './TeamPresetRow.tsx';

export default function TeamPresets({ team }: { team: z.infer<typeof userTeamSchema> }) {
  const { t } = useTranslations();
  const maxTeamPresetCount = useGlobalStore((state) => state.settings.user.maxTeamPresetCount);

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: presets,
    loading,
    error,
    search,
    debouncedSearch,
    setSearch,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.teams.presets(team.uuid),
    fetcher: (page, search, perPage) => getTeamPresets(team.uuid, page, search, perPage),
  });

  const canManage = canManageTeamPresets(team);

  const {
    selected: selectedPresets,
    toggle: togglePreset,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: presets?.data, shortcuts: canManage });

  const atLimit = (presets?.total ?? 0) >= maxTeamPresetCount;
  const isEmpty = !loading && !error && !debouncedSearch && presets?.total === 0;

  const createButton = (label: string) => (
    <ConditionalTooltip
      enabled={atLimit}
      label={t('pages.account.teams.tabs.presets.tooltip.limitReached', { max: maxTeamPresetCount })}
    >
      <Button
        onClick={() => setOpenModal('create')}
        color='blue'
        leftSection={<FontAwesomeIcon icon={faPlus} />}
        disabled={!presets || atLimit}
      >
        {label}
      </Button>
    </ConditionalTooltip>
  );

  return (
    <AccountSubContentContainer
      title={t('pages.account.teams.tabs.presets.title', {})}
      subtitle={t('pages.account.teams.tabs.presets.subtitle', {})}
      titleOrder={2}
      search={search}
      setSearch={isEmpty ? undefined : setSearch}
      contentRight={isEmpty || !canManage ? undefined : createButton(t('common.button.create', {}))}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.view.presets.subContainer}
      registryProps={{ team }}
    >
      <TeamPresetCreateModal team={team} opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <TeamPresetActionBar
        team={team}
        selectedPresets={selectedPresets}
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
                    indeterminate: selectedPresets.size > 0 && !allSelected,
                    onChange: (checked) => (checked ? selectAll() : clearSelection()),
                  }),
                ]
              : []),
            t('common.table.columns.name', {}),
            t('pages.account.teams.table.columns.weight', {}),
            t('pages.server.subusers.table.columns.permissions', {}),
            t('pages.server.subusers.table.columns.ignoredFiles', {}),
            '',
          ]}
          loading={loading}
          pagination={presets}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
          empty={
            debouncedSearch ? undefined : (
              <EmptyState
                flush
                icon={faIdBadge}
                title={t('pages.account.teams.tabs.presets.empty.title', {})}
                description={
                  canManage
                    ? t('pages.account.teams.tabs.presets.empty.description', {})
                    : t('pages.account.teams.tabs.presets.empty.descriptionReadOnly', {})
                }
              >
                {canManage && createButton(t('pages.account.teams.tabs.presets.button.createFirstPreset', {}))}
              </EmptyState>
            )
          }
        >
          {presets?.data.map((preset) => (
            <SelectionArea.Selectable key={preset.uuid} item={preset}>
              {(innerRef: Ref<HTMLElement>) => (
                <TeamPresetRow
                  team={team}
                  preset={preset}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedPresets.has(preset.uuid)}
                  onSelectionChange={canManage ? (selected, range) => togglePreset(preset, selected, range) : undefined}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AccountSubContentContainer>
  );
}
