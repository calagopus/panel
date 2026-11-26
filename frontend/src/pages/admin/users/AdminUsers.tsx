import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getUsers from '@/api/admin/users/getUsers.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTableColumns } from '@/lib/tableColumns.ts';
import UserView from '@/pages/admin/users/UserView.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import UserCreateOrUpdate from './UserCreateOrUpdate.tsx';
import UserLookupPopover from './UserLookupPopover.tsx';
import UserRow from './UserRow.tsx';

function UsersContainer() {
  const navigate = useNavigate();
  const { t } = useTranslations();

  const {
    data: users,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.all(),
    fetcher: getUsers,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.users.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.admin.users.container}
      search={search}
      setSearch={setSearch}
      contentRight={
        <>
          <UserLookupPopover />
          <AdminCan action='users.create'>
            <Button
              onClick={() => navigate('/admin/users/new')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.create', {})}
            </Button>
          </AdminCan>
        </>
      }
    >
      <Table
        columns={userTableColumns()}
        loading={loading}
        error={error}
        pagination={users}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
      >
        {users?.data.map((user) => (
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
