import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getEggConfigurations from '@/api/admin/egg-configurations/getEggConfigurations.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { eggConfigurationTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import EggConfigurationCreateOrUpdate from './EggConfigurationCreateOrUpdate.tsx';
import EggConfigurationRow from './EggConfigurationRow.tsx';
import EggConfigurationView from './EggConfigurationView.tsx';

function EggConfigurationsContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();

  const {
    data: eggConfigurations,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.eggConfigurations.all(),
    fetcher: getEggConfigurations,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.eggConfigurations.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='egg-configurations.create'>
          <Button
            onClick={() => navigate('/admin/egg-configurations/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>
        </AdminCan>
      }
    >
      <Table
        columns={eggConfigurationTableColumns()}
        loading={loading}
        error={error}
        pagination={eggConfigurations}
        onPageSelect={setPage}
      >
        {eggConfigurations?.data.map((ec) => (
          <EggConfigurationRow key={ec.uuid} eggConfiguration={ec} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminEggConfigurations() {
  return (
    <Routes>
      <Route path='/' element={<EggConfigurationsContainer />} />
      <Route path='/:id/*' element={<EggConfigurationView />} />
      <Route element={<AdminPermissionGuard permission='egg-configurations.create' />}>
        <Route path='/new' element={<EggConfigurationCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
