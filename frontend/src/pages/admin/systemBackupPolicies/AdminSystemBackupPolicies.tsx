import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getSystemBackupPolicies from '@/api/admin/system-backup-policies/getSystemBackupPolicies.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { systemBackupPolicyTableColumns } from '@/lib/tableColumns.ts';
import SystemBackupPolicyCreateOrUpdate from '@/pages/admin/systemBackupPolicies/SystemBackupPolicyCreateOrUpdate.tsx';
import SystemBackupPolicyRow from '@/pages/admin/systemBackupPolicies/SystemBackupPolicyRow.tsx';
import SystemBackupPolicyView from '@/pages/admin/systemBackupPolicies/SystemBackupPolicyView.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';

function SystemBackupPoliciesContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();

  const {
    data: systemBackupPolicies,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.systemBackupPolicies.all(),
    fetcher: getSystemBackupPolicies,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.systemBackupPolicies.title', {})}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.container}
      contentRight={
        <AdminCan action='system-backup-policies.create'>
          <Button
            onClick={() => navigate('/admin/system-backup-policies/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>
        </AdminCan>
      }
    >
      <Table
        columns={systemBackupPolicyTableColumns()}
        loading={loading}
        pagination={systemBackupPolicies}
        onPageSelect={setPage}
        error={error}
      >
        {systemBackupPolicies?.data.map((systemBackupPolicy) => (
          <SystemBackupPolicyRow key={systemBackupPolicy.uuid} systemBackupPolicy={systemBackupPolicy} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminSystemBackupPolicies() {
  return (
    <Routes>
      <Route path='/' element={<SystemBackupPoliciesContainer />} />
      <Route path='/:id/*' element={<SystemBackupPolicyView />} />
      <Route element={<AdminPermissionGuard permission='system-backup-policies.create' />}>
        <Route path='/new' element={<SystemBackupPolicyCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
