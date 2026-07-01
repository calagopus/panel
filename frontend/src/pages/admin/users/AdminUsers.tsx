import { faFingerprint, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import getUsers from '@/api/admin/users/getUsers.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTableColumns } from '@/lib/tableColumns.ts';
import UserView from '@/pages/admin/users/UserView.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import ExternalIdLookupModal from './modals/ExternalIdLookupModal.tsx';
import UserCreateOrUpdate from './UserCreateOrUpdate.tsx';
import UserRow from './UserRow.tsx';

function UsersContainer() {
  const navigate = useNavigate();
  const { t } = useTranslations();
  const [lookupOpen, setLookupOpen] = useState(false);

  const {
    data: users,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.all(),
    fetcher: getUsers,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.users.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <>
          <ExternalIdLookupModal opened={lookupOpen} onClose={() => setLookupOpen(false)} />
          <AdminCan action='users.read'>
            <Button
              onClick={() => setLookupOpen(true)}
              variant='default'
              leftSection={<FontAwesomeIcon icon={faFingerprint} />}
            >
              {t('pages.admin.users.externalIdLookup.button', {})}
            </Button>
          </AdminCan>
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
      <Table columns={userTableColumns()} loading={loading} pagination={users} onPageSelect={setPage}>
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
