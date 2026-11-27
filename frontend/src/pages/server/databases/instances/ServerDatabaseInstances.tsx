import { faPlus, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { z } from 'zod';
import getDatabaseInstances from '@/api/server/databases/instances/getDatabaseInstances.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabasesSubNavigation from '../DatabasesSubNavigation.tsx';
import { useDatabaseRelevance } from '../useDatabaseRelevance.ts';
import DatabaseInstanceActionBar from './DatabaseInstanceActionBar.tsx';
import DatabaseInstanceRow from './DatabaseInstanceRow.tsx';
import DatabaseInstanceCreateModal from './modals/DatabaseInstanceCreateModal.tsx';

export default function ServerDatabaseInstances() {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);

  const canCreate = useServerCan('database-instances.create');
  const canSelect = useServerCan(['database-instances.power', 'database-instances.delete']);

  const [createOpen, setCreateOpen] = useState(false);

  const { canReadAgent, used, full, agentTemplates, settled } = useDatabaseRelevance();

  const { data, loading, error, search, debouncedSearch, setSearch, setPage, setPerPage, refetch } =
    useSearchablePaginatedTable({
      queryKey: queryKeys.server(server.uuid).databases.instances.all(),
      fetcher: (page, search, perPage) => getDatabaseInstances(server.uuid, page, search, perPage),
      canRequest: canReadAgent,
    });

  const {
    selected: selectedInstances,
    toggle: toggleInstance,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: data?.data, shortcuts: canSelect });

  const handleInstanceClick = (instance: z.infer<typeof serverDatabaseInstanceSchema>, event: React.MouseEvent) => {
    if (canSelect && (event.ctrlKey || event.metaKey || event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      toggleInstance(instance, !selectedInstances.has(instance.uuid), event.shiftKey);
    }
  };

  const disabled = !settled || full || agentTemplates.length === 0;
  const noTemplates = !full && agentTemplates.length === 0;
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
          <ServerCan action='database-instances.create'>
            <ConditionalTooltip
              enabled={settled && disabled}
              label={
                full
                  ? t('common.tooltip.limitReached.server', {
                      items: tItem('database', server.featureLimits.databases),
                    })
                  : t('pages.server.databases.instance.modal.createDatabaseInstance.form.noTemplatesFound', {})
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
      registry={window.extensionContext.extensionRegistry.pages.server.databases.instances.container}
    >
      <DatabaseInstanceCreateModal opened={createOpen} onClose={() => setCreateOpen(false)} />

      <DatabasesSubNavigation>
        <DatabaseInstanceActionBar
          selectedInstances={selectedInstances}
          clearSelection={clearSelection}
          onFinished={refetch}
        />

        <SelectionArea {...selectionAreaProps} disabled={!canSelect}>
          <Table
            columns={[
              ...(canSelect
                ? [
                    tableSelectionHeader({
                      checked: allSelected,
                      indeterminate: selectedInstances.size > 0 && !allSelected,
                      onChange: (checked) => (checked ? selectAll() : clearSelection()),
                    }),
                  ]
                : []),
              t('common.table.columns.name', {}),
              t('common.table.columns.type', {}),
              t('common.table.columns.address', {}),
              t('common.form.memory', {}),
              t('common.form.disk', {}),
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
                  icon={faServer}
                  title={t('pages.server.databases.instance.empty.title', {})}
                  description={
                    !canCreate
                      ? t('pages.server.databases.instance.empty.descriptionReadOnly', {})
                      : noTemplates
                        ? t('pages.server.databases.instance.empty.descriptionUnavailable', {})
                        : t('pages.server.databases.instance.empty.description', {})
                  }
                >
                  {noTemplates ? null : (
                    <ServerCan action='database-instances.create'>
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
                          {t('pages.server.databases.instance.button.createFirstInstance', {})}
                        </Button>
                      </ConditionalTooltip>
                    </ServerCan>
                  )}
                </EmptyState>
              )
            }
          >
            {data?.data.map((instance) => (
              <SelectionArea.Selectable key={instance.uuid} item={instance}>
                {(innerRef: Ref<HTMLElement>) => (
                  <DatabaseInstanceRow
                    instance={instance}
                    ref={innerRef as Ref<HTMLTableRowElement>}
                    isSelected={selectedInstances.has(instance.uuid)}
                    onSelectionChange={
                      canSelect ? (selected, range) => toggleInstance(instance, selected, range) : undefined
                    }
                    onClick={(e) => handleInstanceClick(instance, e)}
                  />
                )}
              </SelectionArea.Selectable>
            ))}
          </Table>
        </SelectionArea>
      </DatabasesSubNavigation>
    </ServerContentContainer>
  );
}
