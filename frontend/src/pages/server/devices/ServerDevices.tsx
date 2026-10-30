import { Ref } from 'react';
import getDevices from '@/api/server/devices/getDevices.ts';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import DeviceActionBar from '@/pages/server/devices/DeviceActionBar.tsx';
import { DeviceRow } from '@/pages/server/devices/DeviceRow.tsx';
import MountsSubNavigation from '@/pages/server/mounts/MountsSubNavigation.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerDevices() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const canSelect = useServerCan(['devices.attach', 'devices.detach']);

  const {
    data: devices,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).devices.all(),
    fetcher: (page, search, perPage) => getDevices(server.uuid, page, search, perPage),
    backgroundRefetch: true,
  });

  const {
    selected: selectedDevices,
    toggle: toggleDevice,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: devices?.data, shortcuts: canSelect });

  return (
    <ServerContentContainer
      title={t('pages.server.devices.title', {})}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.server.devices.container}
    >
      <MountsSubNavigation />

      <DeviceActionBar selectedDevices={selectedDevices} clearSelection={clearSelection} />

      <SelectionArea {...selectionAreaProps} disabled={!canSelect}>
        <Table
          columns={[
            ...(canSelect
              ? [
                  tableSelectionHeader({
                    checked: allSelected,
                    indeterminate: selectedDevices.size > 0 && !allSelected,
                    onChange: (checked) => (checked ? selectAll() : clearSelection()),
                  }),
                ]
              : []),
            t('common.table.columns.name', {}),
            t('common.table.columns.description', {}),
            t('common.table.columns.target', {}),
            t('pages.server.devices.table.columns.attached', {}),
            t('pages.admin.devices.tabs.general.page.form.permissions', {}),
            '',
          ]}
          loading={loading}
          pagination={devices}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
        >
          {devices?.data.map((device) => (
            <SelectionArea.Selectable key={device.uuid} item={device}>
              {(innerRef: Ref<HTMLElement>) => (
                <DeviceRow
                  contextDevice={device}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedDevices.has(device.uuid)}
                  onSelectionChange={canSelect ? (selected, range) => toggleDevice(device, selected, range) : undefined}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </ServerContentContainer>
  );
}
