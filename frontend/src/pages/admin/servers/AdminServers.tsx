import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getServers from '@/api/admin/servers/getServers.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import ServerCreate from './ServerCreate.tsx';
import ServerRow from './ServerRow.tsx';
import ServerView from './ServerView.tsx';

function ServersContainer() {
  const navigate = useNavigate();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.servers.all(),
    fetcher: getServers,
  });

  const servers = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminContentContainer
      title='Servers'
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='servers.create'>
          <Button
            onClick={() => navigate('/admin/servers/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            Create
          </Button>
        </AdminCan>
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.container}
    >
      <Table columns={serverTableColumns} loading={loading} pagination={servers} onPageSelect={setPage}>
        {servers.data.map((server) => (
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
