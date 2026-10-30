import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import createAllocation from '@/api/server/allocations/createAllocation.ts';
import getAllocations from '@/api/server/allocations/getAllocations.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import AllocationActionBar from './AllocationActionBar.tsx';
import AllocationRow from './AllocationRow.tsx';
import ServerFirewall from './firewall/ServerFirewall.tsx';
import NetworkSubNavigation from './NetworkSubNavigation.tsx';
import ServerTunnel from './tunnel/ServerTunnel.tsx';

export default function ServerNetwork() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const canReadAllocations = useServerCan('allocations.read');
  const canReadFirewall = useServerCan('firewall.read');
  const canDelete = useServerCan('allocations.delete');

  const {
    data: allocations,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).network.all(),
    fetcher: (page, search, perPage) => getAllocations(server.uuid, page, search, perPage),
    canRequest: canReadAllocations,
    backgroundRefetch: true,
  });

  const {
    selected: selectedAllocations,
    toggle: toggleAllocation,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: allocations?.data, shortcuts: canDelete });

  const [adding, setAdding] = useState(false);

  const doAdd = () => {
    setAdding(true);
    createAllocation(server.uuid)
      .then(() => {
        refetch();
        addToast(t('pages.server.network.toast.created', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setAdding(false));
  };

  if (!canReadAllocations) {
    return canReadFirewall ? <ServerFirewall /> : <ServerTunnel />;
  }

  return (
    <ServerContentContainer
      title={t('pages.server.network.allocations.title', {})}
      subtitle={t('pages.server.network.subtitle', {
        current: allocations?.total ?? '…',
        max: server.featureLimits.allocations,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ServerCan action='allocations.create'>
          <ConditionalTooltip
            enabled={(allocations?.total ?? 0) >= server.featureLimits.allocations}
            label={t('pages.server.network.tooltip.limitReached', { max: server.featureLimits.allocations })}
          >
            <Button
              disabled={!allocations || allocations.total >= server.featureLimits.allocations}
              loading={adding}
              onClick={doAdd}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.add', {})}
            </Button>
          </ConditionalTooltip>
        </ServerCan>
      }
      registry={window.extensionContext.extensionRegistry.pages.server.network.container}
    >
      <NetworkSubNavigation />

      <AllocationActionBar
        selectedAllocations={selectedAllocations}
        clearSelection={clearSelection}
        onFinished={refetch}
      />

      <SelectionArea {...selectionAreaProps} disabled={!canDelete}>
        <Table
          columns={[
            ...(canDelete
              ? [
                  tableSelectionHeader({
                    checked: allSelected,
                    indeterminate: selectedAllocations.size > 0 && !allSelected,
                    onChange: (checked) => (checked ? selectAll() : clearSelection()),
                  }),
                ]
              : []),
            '',
            t('pages.server.network.table.columns.hostname', {}),
            t('pages.server.network.table.columns.port', {}),
            t('common.table.columns.notes', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          pagination={allocations}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
        >
          {allocations?.data.map((allocation) => (
            <SelectionArea.Selectable key={allocation.uuid} item={allocation}>
              {(innerRef: Ref<HTMLElement>) => (
                <AllocationRow
                  allocation={allocation}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedAllocations.has(allocation.uuid)}
                  onSelectionChange={
                    canDelete ? (selected, range) => toggleAllocation(allocation, selected, range) : undefined
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
