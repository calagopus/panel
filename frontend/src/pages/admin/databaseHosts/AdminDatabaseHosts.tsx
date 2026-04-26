import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getDatabaseHosts from '@/api/admin/database-hosts/getDatabaseHosts.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { databaseHostTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import DatabaseHostCreateOrUpdate from './DatabaseHostCreateOrUpdate.tsx';
import DatabaseHostRow from './DatabaseHostRow.tsx';
import DatabaseHostView from './DatabaseHostView.tsx';

function DatabaseHostsContainer() {
  const navigate = useNavigate();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.databaseHosts.all(),
    fetcher: getDatabaseHosts,
  });

  const databaseHosts = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminContentContainer
      title='Database Hosts'
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='database-hosts.create'>
          <Button
            onClick={() => navigate('/admin/database-hosts/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            Create
          </Button>
        </AdminCan>
      }
    >
      <Table columns={databaseHostTableColumns} loading={loading} pagination={databaseHosts} onPageSelect={setPage}>
        {databaseHosts.data.map((dh) => (
          <DatabaseHostRow key={dh.uuid} databaseHost={dh} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminDatabaseHosts() {
  return (
    <Routes>
      <Route path='/' element={<DatabaseHostsContainer />} />
      <Route path='/:id/*' element={<DatabaseHostView />} />
      <Route element={<AdminPermissionGuard permission='database-hosts.create' />}>
        <Route path='/new' element={<DatabaseHostCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
