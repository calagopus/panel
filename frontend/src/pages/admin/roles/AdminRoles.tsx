import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getRoles from '@/api/admin/roles/getRoles.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { roleTableColumns } from '@/lib/tableColumns.ts';
import RoleCreateOrUpdate from '@/pages/admin/roles/RoleCreateOrUpdate.tsx';
import RoleRow from '@/pages/admin/roles/RoleRow.tsx';
import RoleView from '@/pages/admin/roles/RoleView.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';

function RolesContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();

  const {
    data: roles,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.roles.all(),
    fetcher: getRoles,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.roles.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.admin.roles.container}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='roles.create'>
          <Button
            onClick={() => navigate('/admin/roles/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>
        </AdminCan>
      }
    >
      <Table columns={roleTableColumns()} loading={loading} pagination={roles} onPageSelect={setPage} error={error}>
        {roles?.data.map((role) => (
          <RoleRow key={role.uuid} role={role} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminRoles() {
  return (
    <Routes>
      <Route path='/' element={<RolesContainer />} />
      <Route path='/:id/*' element={<RoleView />} />
      <Route element={<AdminPermissionGuard permission='roles.create' />}>
        <Route path='/new' element={<RoleCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
