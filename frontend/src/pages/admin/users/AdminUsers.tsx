import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getUsers from '@/api/admin/users/getUsers.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTableColumns } from '@/lib/tableColumns.ts';
import UserView from '@/pages/admin/users/UserView.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import UserCreateOrUpdate from './UserCreateOrUpdate.tsx';
import UserRow from './UserRow.tsx';

function UsersContainer() {
  const navigate = useNavigate();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.all(),
    fetcher: getUsers,
  });

  const users = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminContentContainer
      title='Users'
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='users.create'>
          <Button
            onClick={() => navigate('/admin/users/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            Create
          </Button>
        </AdminCan>
      }
    >
      <Table columns={userTableColumns} loading={loading} pagination={users} onPageSelect={setPage}>
        {users.data.map((user) => (
          <UserRow key={user.uuid} user={user} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminUsers() {
  return (
    <Routes>
      <Route path='/' element={<UsersContainer />} />
      <Route path='/:id/*' element={<UserView />} />
      <Route element={<AdminPermissionGuard permission='users.create' />}>
        <Route path='/new' element={<UserCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
