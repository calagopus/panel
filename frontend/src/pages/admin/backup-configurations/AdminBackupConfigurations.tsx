import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { backupConfigurationTableColumns } from '@/lib/tableColumns.ts';
import BackupConfigurationCreateOrUpdate from '@/pages/admin/backup-configurations/BackupConfigurationCreateOrUpdate.tsx';
import BackupConfigurationRow from '@/pages/admin/backup-configurations/BackupConfigurationRow.tsx';
import BackupConfigurationView from '@/pages/admin/backup-configurations/BackupConfigurationView.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';

function BackupConfigurationsContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();

  const {
    data: backupConfigurations,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: getBackupConfigurations,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.backupConfigurations.title', {})}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.backupConfigurations.container}
      contentRight={
        <AdminCan action='backup-configurations.create'>
          <Button
            onClick={() => navigate('/admin/backup-configurations/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>
        </AdminCan>
      }
    >
      <Table
        columns={backupConfigurationTableColumns()}
        loading={loading}
        pagination={backupConfigurations}
        onPageSelect={setPage}
        error={error}
      >
        {backupConfigurations?.data.map((bc) => (
          <BackupConfigurationRow key={bc.uuid} backupConfiguration={bc} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminBackupConfigurations() {
  return (
    <Routes>
      <Route path='/' element={<BackupConfigurationsContainer />} />
      <Route path='/:id/*' element={<BackupConfigurationView />} />
      <Route element={<AdminPermissionGuard permission='backup-configurations.create' />}>
        <Route path='/new' element={<BackupConfigurationCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
