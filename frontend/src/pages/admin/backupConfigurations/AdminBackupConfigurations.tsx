import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { backupConfigurationTableColumns } from '@/lib/tableColumns.ts';
import BackupConfigurationCreateOrUpdate from '@/pages/admin/backupConfigurations/BackupConfigurationCreateOrUpdate.tsx';
import BackupConfigurationRow from '@/pages/admin/backupConfigurations/BackupConfigurationRow.tsx';
import BackupConfigurationView from '@/pages/admin/backupConfigurations/BackupConfigurationView.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';

function BackupConfigurationsContainer() {
  const navigate = useNavigate();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: getBackupConfigurations,
  });

  const backupConfigurations = data ?? getEmptyPaginationSet<z.infer<typeof adminBackupConfigurationSchema>>();

  return (
    <AdminContentContainer
      title='Backup Configurations'
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='backup-configurations.create'>
          <Button
            onClick={() => navigate('/admin/backup-configurations/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            Create
          </Button>
        </AdminCan>
      }
    >
      <Table
        columns={backupConfigurationTableColumns}
        loading={loading}
        pagination={backupConfigurations}
        onPageSelect={setPage}
      >
        {backupConfigurations.data.map((bc) => (
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
