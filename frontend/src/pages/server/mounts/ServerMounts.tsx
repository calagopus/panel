import { Ref } from 'react';
import getMounts from '@/api/server/mounts/getMounts.ts';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import ServerDevices from '@/pages/server/devices/ServerDevices.tsx';
import MountActionBar from '@/pages/server/mounts/MountActionBar.tsx';
import { MountRow } from '@/pages/server/mounts/MountRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import MountsSubNavigation from './MountsSubNavigation.tsx';

export default function ServerMounts() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const canReadMounts = useServerCan('mounts.read');
  const canSelect = useServerCan(['mounts.attach', 'mounts.detach']);

  const {
    data: mounts,
    loading,
    error,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).mounts.all(),
    fetcher: () => getMounts(server.uuid),
    canRequest: canReadMounts,
    backgroundRefetch: true,
  });

  const {
    selected: selectedMounts,
    toggle: toggleMount,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: mounts?.data, shortcuts: canSelect });

  if (!canReadMounts) {
    return <ServerDevices />;
  }

  return (
    <ServerContentContainer
      title={t('pages.server.mounts.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.server.mounts.container}
    >
      <MountsSubNavigation />

      <MountActionBar selectedMounts={selectedMounts} clearSelection={clearSelection} />

      <SelectionArea {...selectionAreaProps} disabled={!canSelect}>
        <Table
          columns={[
            ...(canSelect
              ? [
                  tableSelectionHeader({
                    checked: allSelected,
                    indeterminate: selectedMounts.size > 0 && !allSelected,
                    onChange: (checked) => (checked ? selectAll() : clearSelection()),
                  }),
                ]
              : []),
            t('common.table.columns.name', {}),
            t('common.table.columns.description', {}),
            t('common.table.columns.target', {}),
            t('pages.server.mounts.table.columns.mounted', {}),
            t('common.readOnly', {}),
            '',
          ]}
          loading={loading}
          pagination={mounts}
          error={error}
        >
          {mounts?.data.map((mount) => (
            <SelectionArea.Selectable key={mount.uuid} item={mount}>
              {(innerRef: Ref<HTMLElement>) => (
                <MountRow
                  contextMount={mount}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedMounts.has(mount.uuid)}
                  onSelectionChange={canSelect ? (selected, range) => toggleMount(mount, selected, range) : undefined}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </ServerContentContainer>
  );
}
