import { faPlus, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import getSubusers from '@/api/server/subusers/getSubusers.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import SubuserCreateModal from './modals/SubuserCreateModal.tsx';
import SubuserActionBar from './SubuserActionBar.tsx';
import SubuserRow from './SubuserRow.tsx';
import SubuserTeamMembers from './SubuserTeamMembers.tsx';

export default function ServerSubusers() {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const settings = useGlobalStore((state) => state.settings);

  const canCreate = useServerCan('subusers.create');
  const canDelete = useServerCan('subusers.delete');

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: subusers,
    loading,
    error,
    search,
    debouncedSearch,
    setSearch,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).subusers.all(),
    fetcher: (page, search, perPage) => getSubusers(server.uuid, page, search, perPage),
  });

  const {
    selected: selectedSubusers,
    toggle: toggleSubuser,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({
    items: subusers?.data,
    identify: (subuser) => subuser.user.uuid,
    shortcuts: canDelete,
  });

  const atLimit = (subusers?.total ?? 0) >= settings.server.maxSubuserCount;
  const isEmpty = !loading && !error && !debouncedSearch && subusers?.total === 0;

  return (
    <ServerContentContainer
      title={t('pages.server.subusers.title', {})}
      subtitle={t('common.label.limitUsage.created', {
        current: subusers?.total ?? '...',
        max: settings.server.maxSubuserCount,
      })}
      search={search}
      setSearch={isEmpty ? undefined : setSearch}
      contentRight={
        isEmpty ? undefined : (
          <ServerCan action='subusers.create'>
            <ConditionalTooltip
              enabled={atLimit}
              label={t('common.tooltip.limitReached.server', {
                items: tItem('subuser', settings.server.maxSubuserCount),
              })}
            >
              <Button
                onClick={() => setOpenModal('create')}
                color='blue'
                leftSection={<FontAwesomeIcon icon={faPlus} />}
                disabled={!subusers || atLimit}
              >
                {t('common.button.create', {})}
              </Button>
            </ConditionalTooltip>
          </ServerCan>
        )
      }
      registry={window.extensionContext.extensionRegistry.pages.server.subusers.container}
    >
      <SubuserCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <SubuserActionBar selectedSubusers={selectedSubusers} clearSelection={clearSelection} onFinished={refetch} />

      <SelectionArea {...selectionAreaProps} disabled={!canDelete}>
        <Table
          columns={[
            ...(canDelete
              ? [
                  tableSelectionHeader({
                    checked: allSelected,
                    indeterminate: selectedSubusers.size > 0 && !allSelected,
                    onChange: (checked) => (checked ? selectAll() : clearSelection()),
                  }),
                ]
              : []),
            '',
            t('common.table.columns.username', {}),
            t('pages.server.subusers.table.columns.twoFactorEnabled', {}),
            t('pages.server.subusers.table.columns.permissions', {}),
            t('pages.server.subusers.table.columns.ignoredFiles', {}),
            '',
          ]}
          loading={loading}
          pagination={subusers}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
          empty={
            debouncedSearch ? undefined : (
              <EmptyState
                flush
                icon={faUsers}
                title={t('pages.server.subusers.empty.title', {})}
                description={
                  canCreate
                    ? t('pages.server.subusers.empty.description', {})
                    : t('pages.server.subusers.empty.descriptionReadOnly', {})
                }
              >
                <ServerCan action='subusers.create'>
                  <ConditionalTooltip
                    enabled={atLimit}
                    label={t('common.tooltip.limitReached.server', {
                      items: tItem('subuser', settings.server.maxSubuserCount),
                    })}
                  >
                    <Button
                      onClick={() => setOpenModal('create')}
                      color='blue'
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                      disabled={!subusers || atLimit}
                    >
                      {t('pages.server.subusers.button.createFirstSubuser', {})}
                    </Button>
                  </ConditionalTooltip>
                </ServerCan>
              </EmptyState>
            )
          }
        >
          {subusers?.data.map((su) => (
            <SelectionArea.Selectable key={su.user.uuid} item={su}>
              {(innerRef: Ref<HTMLElement>) => (
                <SubuserRow
                  subuser={su}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedSubusers.has(su.user.uuid)}
                  onSelectionChange={canDelete ? (selected, range) => toggleSubuser(su, selected, range) : undefined}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>

      {server.teamUuid && <SubuserTeamMembers />}
    </ServerContentContainer>
  );
}
