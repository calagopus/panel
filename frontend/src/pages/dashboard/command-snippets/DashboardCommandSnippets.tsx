import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import getCommandSnippets from '@/api/me/command-snippets/getCommandSnippets.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import CommandSnippetActionBar from './CommandSnippetActionBar.tsx';
import CommandSnippetRow from './CommandSnippetRow.tsx';
import CommandSnippetCreateModal from './modals/CommandSnippetCreateModal.tsx';

export default function DashboardCommandSnippets() {
  const { t } = useTranslations();
  const settings = useGlobalStore((state) => state.settings);

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: commandSnippets,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.commandSnippets.all(),
    fetcher: getCommandSnippets,
  });

  const atLimit = (commandSnippets?.total ?? 0) >= settings.user.maxCommandSnippetCount;

  const {
    selected: selectedCommandSnippets,
    toggle: toggleCommandSnippet,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: commandSnippets?.data });

  return (
    <AccountContentContainer
      title={t('pages.account.commandSnippets.title', {})}
      subtitle={t('pages.account.commandSnippets.subtitle', {
        current: commandSnippets?.total ?? 0,
        max: settings.user.maxCommandSnippetCount,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ConditionalTooltip
          enabled={atLimit}
          label={t('pages.account.commandSnippets.tooltip.limitReached', { max: settings.user.maxCommandSnippetCount })}
        >
          <Button
            onClick={() => setOpenModal('create')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
            disabled={atLimit}
          >
            {t('common.button.create', {})}
          </Button>
        </ConditionalTooltip>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.commandSnippets.container}
    >
      <CommandSnippetCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <CommandSnippetActionBar
        selectedCommandSnippets={selectedCommandSnippets}
        clearSelection={clearSelection}
        onFinished={refetch}
      />

      <SelectionArea {...selectionAreaProps}>
        <Table
          columns={[
            tableSelectionHeader({
              checked: allSelected,
              indeterminate: selectedCommandSnippets.size > 0 && !allSelected,
              onChange: (checked) => (checked ? selectAll() : clearSelection()),
            }),
            t('common.table.columns.name', {}),
            t('pages.account.commandSnippets.table.columns.appliesTo', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          pagination={commandSnippets}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
        >
          {commandSnippets?.data.map((snippet) => (
            <SelectionArea.Selectable key={snippet.uuid} item={snippet}>
              {(innerRef: Ref<HTMLElement>) => (
                <CommandSnippetRow
                  atLimit={atLimit}
                  commandSnippet={snippet}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedCommandSnippets.has(snippet.uuid)}
                  onSelectionChange={(selected, range) => toggleCommandSnippet(snippet, selected, range)}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AccountContentContainer>
  );
}
