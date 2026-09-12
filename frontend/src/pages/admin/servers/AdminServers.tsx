import { faFingerprint, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { Ref, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import getServers from '@/api/admin/servers/getServers.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminTableSelection } from '@/plugins/selection/useAdminTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import ExternalIdLookupModal from './modals/ExternalIdLookupModal.tsx';
import ServerActionBar from './ServerActionBar.tsx';
import ServerCreate from './ServerCreate.tsx';
import ServerRow from './ServerRow.tsx';
import ServerView from './ServerView.tsx';

function ServersContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lookupOpen, setLookupOpen] = useState(false);

  const {
    data: servers,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.servers.all(),
    fetcher: getServers,
  });

  const {
    selected: selectedServers,
    clear: clearSelectedServers,
    toggle: toggleServer,
    selectionAreaProps,
  } = useAdminTableSelection<AdminServer>({ items: servers?.data });

  const handleServerClick = (server: AdminServer, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      toggleServer(server, !selectedServers.has(server));
    }
  };

  return (
    <>
      <AdminContentContainer
        title={t('pages.admin.servers.title', {})}
        search={search}
        setSearch={setSearch}
        contentRight={
          <>
            <ExternalIdLookupModal opened={lookupOpen} onClose={() => setLookupOpen(false)} />
            <AdminCan action='servers.read'>
              <Button
                onClick={() => setLookupOpen(true)}
                variant='default'
                leftSection={<FontAwesomeIcon icon={faFingerprint} />}
              >
                {t('pages.admin.servers.externalIdLookup.button', {})}
              </Button>
            </AdminCan>
            <AdminCan action='servers.create'>
              <Button
                onClick={() => navigate('/admin/servers/new')}
                color='blue'
                leftSection={<FontAwesomeIcon icon={faPlus} />}
              >
                {t('common.button.create', {})}
              </Button>
            </AdminCan>
          </>
        }
        registry={window.extensionContext.extensionRegistry.pages.admin.servers.container}
      >
        <SelectionArea {...selectionAreaProps}>
          <Table
            columns={['', ...serverTableColumns()]}
            loading={loading}
            pagination={servers}
            onPageSelect={setPage}
            error={error}
            allowSelect={false}
          >
            {servers?.data.map((server) => (
              <SelectionArea.Selectable key={server.uuid} item={server}>
                {(innerRef: Ref<HTMLElement>) => (
                  <ServerRow
                    server={server}
                    ref={innerRef as Ref<HTMLTableRowElement>}
                    showSelection={true}
                    isSelected={selectedServers.has(server.uuid)}
                    onSelectionChange={(selected) => toggleServer(server, selected)}
                    onClick={(e) => handleServerClick(server, e)}
                  />
                )}
              </SelectionArea.Selectable>
            ))}
          </Table>
        </SelectionArea>
      </AdminContentContainer>

      <ServerActionBar
        selectedServers={selectedServers}
        clearSelectedServers={clearSelectedServers}
        invalidateServers={() => queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.all() })}
      />
    </>
  );
}

export default function AdminServers() {
  return (
    <Routes>
      <Route path='/' element={<ServersContainer />} />
      <Route path='/:id/*' element={<ServerView />} />
      <Route element={<AdminPermissionGuard permission='servers.create' />}>
        <Route path='/new' element={<ServerCreate />} />
      </Route>
    </Routes>
  );
}
