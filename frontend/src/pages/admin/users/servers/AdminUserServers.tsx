import { useQueryClient } from '@tanstack/react-query';
import { Ref, useState } from 'react';
import { z } from 'zod';
import getUserServers from '@/api/admin/users/servers/getUserServers.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import ServerActionBar from '@/pages/admin/servers/ServerActionBar.tsx';
import ServerRow from '@/pages/admin/servers/ServerRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useSelectKeyHeld } from '@/plugins/selection/useSelectKeyHeld.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminUserServers({ user }: { user: z.infer<typeof adminFullUserSchema> }) {
  const { t } = useTranslations();
  const queryClient = useQueryClient();
  const sKeyPressedRef = useSelectKeyHeld();
  const [showOwnedUserServers, setShowOwnedUserServers] = useState(false);

  const {
    data: userServers,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.servers(user.uuid),
    fetcher: (page, search, perPage) => getUserServers(user.uuid, page, search, showOwnedUserServers, perPage),
    deps: [showOwnedUserServers],
  });

  const {
    selected: selectedServers,
    clear: clearSelectedServers,
    toggle: toggleServer,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection<AdminServer>({ items: userServers?.data });

  const handleServerClick = (server: AdminServer, event: React.MouseEvent) => {
    if (sKeyPressedRef.current || event.ctrlKey || event.metaKey || event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      toggleServer(server, !selectedServers.has(server), event.shiftKey);
    }
  };

  return (
    <>
      <AdminSubContentContainer
        title={t('pages.admin.users.tabs.servers.page.title', {})}
        titleOrder={2}
        search={search}
        setSearch={setSearch}
        registry={window.extensionContext.extensionRegistry.pages.admin.users.view.servers.subContainer}
        registryProps={{ user }}
        contentRight={
          <Switch
            label={t('pages.admin.users.tabs.servers.page.showOwnedOnly', {})}
            checked={showOwnedUserServers}
            onChange={(e) => setShowOwnedUserServers(e.currentTarget.checked)}
          />
        }
      >
        <SelectionArea {...selectionAreaProps}>
          <Table
            columns={[
              tableSelectionHeader({
                checked: allSelected,
                indeterminate: selectedServers.size > 0 && !allSelected,
                onChange: (checked) => (checked ? selectAll() : clearSelectedServers()),
              }),
              ...serverTableColumns(),
            ]}
            loading={loading}
            pagination={userServers}
            onPageSelect={setPage}
            onPerPageSelect={setPerPage}
            error={error}
          >
            {userServers?.data.map((server) => (
              <SelectionArea.Selectable key={server.uuid} item={server}>
                {(innerRef: Ref<HTMLElement>) => (
                  <ServerRow
                    server={server}
                    ref={innerRef as Ref<HTMLTableRowElement>}
                    isSelected={selectedServers.has(server.uuid)}
                    onSelectionChange={(selected, range) => toggleServer(server, selected, range)}
                    onClick={(e) => handleServerClick(server, e)}
                  />
                )}
              </SelectionArea.Selectable>
            ))}
          </Table>
        </SelectionArea>
      </AdminSubContentContainer>

      <ServerActionBar
        selectedServers={selectedServers}
        clearSelectedServers={clearSelectedServers}
        invalidateServers={() => queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.servers(user.uuid) })}
      />
    </>
  );
}
