import { faDatabase, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import getDatabases from '@/api/server/databases/getDatabases.ts';
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
import { useServerStore } from '@/stores/server.ts';
import DatabaseActionBar from './DatabaseActionBar.tsx';
import DatabaseRow from './DatabaseRow.tsx';
import DatabasesSubNavigation from './DatabasesSubNavigation.tsx';
import ServerDatabaseInstances from './instances/ServerDatabaseInstances.tsx';
import DatabaseCreateModal from './modals/DatabaseCreateModal.tsx';
import { useDatabaseRelevance } from './useDatabaseRelevance.ts';

export default function ServerDatabases() {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);

  const canCreate = useServerCan('databases.create');
  const canDelete = useServerCan('databases.delete');

  const [createOpen, setCreateOpen] = useState(false);

  const { canReadClassic, used, full, databaseHosts, classicRelevant, agentRelevant, settled } = useDatabaseRelevance();

  const { data, loading, error, search, debouncedSearch, setSearch, setPage, setPerPage, refetch } =
    useSearchablePaginatedTable({
      queryKey: queryKeys.server(server.uuid).databases.all(),
      fetcher: (page, search, perPage) => getDatabases(server.uuid, page, search, perPage),
      canRequest: canReadClassic,
    });

  const {
    selected: selectedDatabases,
    toggle: toggleDatabase,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: data?.data, shortcuts: canDelete });

  if (settled && !classicRelevant && agentRelevant) {
    return <ServerDatabaseInstances />;
  }

  const disabled = !settled || full || databaseHosts.length === 0;
  const noHosts = !full && databaseHosts.length === 0;
  const isEmpty = settled && !loading && !error && !debouncedSearch && data?.total === 0;

  return (
    <ServerContentContainer
      title={t('pages.server.databases.title', {})}
      subtitle={t('common.label.limitUsage.created', {
        current: settled ? used : '...',
        max: server.featureLimits.databases,
      })}
      search={search}
      setSearch={isEmpty ? undefined : setSearch}
      contentRight={
        isEmpty ? undefined : (
          <ServerCan action='databases.create'>
            <ConditionalTooltip
              enabled={settled && disabled}
              label={
                full
                  ? t('common.tooltip.limitReached.server', {
                      items: tItem('database', server.featureLimits.databases),
                    })
                  : t('pages.server.databases.modal.createDatabase.form.noHostsFound', {})
              }
            >
              <Button
                disabled={disabled}
                onClick={() => setCreateOpen(true)}
                color='blue'
                leftSection={<FontAwesomeIcon icon={faPlus} />}
              >
                {t('common.button.create', {})}
              </Button>
            </ConditionalTooltip>
          </ServerCan>
        )
      }
      registry={window.extensionContext.extensionRegistry.pages.server.databases.container}
    >
      <DatabaseCreateModal opened={createOpen} onClose={() => setCreateOpen(false)} />

      <DatabasesSubNavigation />

      <DatabaseActionBar selectedDatabases={selectedDatabases} clearSelection={clearSelection} onFinished={refetch} />

      <SelectionArea {...selectionAreaProps} disabled={!canDelete}>
        <Table
          columns={[
            ...(canDelete
              ? [
                  tableSelectionHeader({
                    checked: allSelected,
                    indeterminate: selectedDatabases.size > 0 && !allSelected,
                    onChange: (checked) => (checked ? selectAll() : clearSelection()),
                  }),
                ]
              : []),
            t('common.table.columns.name', {}),
            t('common.table.columns.type', {}),
            t('common.table.columns.address', {}),
            t('common.table.columns.username', {}),
            t('common.table.columns.size', {}),
            t('pages.server.databases.table.columns.locked', {}),
            '',
          ]}
          loading={loading}
          pagination={data}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
          empty={
            debouncedSearch ? undefined : (
              <EmptyState
                flush
                icon={faDatabase}
                title={t('pages.server.databases.empty.title', {})}
                description={
                  !canCreate
                    ? t('pages.server.databases.empty.descriptionReadOnly', {})
                    : noHosts
                      ? t('pages.server.databases.empty.descriptionUnavailable', {})
                      : t('pages.server.databases.empty.description', {})
                }
              >
                {noHosts ? null : (
                  <ServerCan action='databases.create'>
                    <ConditionalTooltip
                      enabled={full}
                      label={t('common.tooltip.limitReached.server', {
                        items: tItem('database', server.featureLimits.databases),
                      })}
                    >
                      <Button
                        disabled={full}
                        onClick={() => setCreateOpen(true)}
                        color='blue'
                        leftSection={<FontAwesomeIcon icon={faPlus} />}
                      >
                        {t('pages.server.databases.button.createFirstDatabase', {})}
                      </Button>
                    </ConditionalTooltip>
                  </ServerCan>
                )}
              </EmptyState>
            )
          }
        >
          {data?.data.map((database) => (
            <SelectionArea.Selectable key={database.uuid} item={database}>
              {(innerRef: Ref<HTMLElement>) => (
                <DatabaseRow
                  database={database}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedDatabases.has(database.uuid)}
                  onSelectionChange={
                    canDelete ? (selected, range) => toggleDatabase(database, selected, range) : undefined
                  }
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </ServerContentContainer>
  );
}
