import { faFingerprint, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import getServers from '@/api/admin/servers/getServers.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import ExternalIdLookupModal from './modals/ExternalIdLookupModal.tsx';
import ServerCreate from './ServerCreate.tsx';
import ServerRow from './ServerRow.tsx';
import ServerView from './ServerView.tsx';

function ServersContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();
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

  return (
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
      <Table columns={serverTableColumns()} loading={loading} pagination={servers} onPageSelect={setPage} error={error}>
        {servers?.data.map((server) => (
          <ServerRow key={server.uuid} server={server} />
        ))}
      </Table>
    </AdminContentContainer>
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
