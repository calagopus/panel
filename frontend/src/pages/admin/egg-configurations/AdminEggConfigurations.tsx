import { faPlus, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import createEggConfiguration from '@/api/admin/egg-configurations/createEggConfiguration.ts';
import getEggConfigurations from '@/api/admin/egg-configurations/getEggConfigurations.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ImportOverlay from '@/elements/ImportOverlay.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggConfigurationUpdateSchema } from '@/lib/schemas/admin/eggConfigurations.ts';
import { eggConfigurationTableColumns } from '@/lib/tableColumns.ts';
import { useResourceImport } from '@/plugins/import/useResourceImport.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import EggConfigurationCreateOrUpdate from './EggConfigurationCreateOrUpdate.tsx';
import EggConfigurationRow from './EggConfigurationRow.tsx';
import EggConfigurationView from './EggConfigurationView.tsx';

function EggConfigurationsContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const canCreate = useAdminCan('egg-configurations.create');

  const {
    data: eggConfigurations,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.eggConfigurations.all(),
    fetcher: getEggConfigurations,
  });

  const { isDragging, openFilePicker, fileInput } = useResourceImport({
    schema: adminEggConfigurationUpdateSchema,
    create: createEggConfiguration,
    onImported: refetch,
    formatParseError: (error) => t('pages.admin.eggConfigurations.toast.parseFailed', { error }),
    importedMessage: t('pages.admin.eggConfigurations.toast.imported', {}),
    enabled: canCreate,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.eggConfigurations.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='egg-configurations.create'>
          <Button onClick={openFilePicker} color='blue'>
            <FontAwesomeIcon icon={faUpload} className='mr-2' />
            {t('common.button.import', {})}
          </Button>
          <Button
            onClick={() => navigate('/admin/egg-configurations/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>

          {fileInput}
        </AdminCan>
      }
    >
      <ImportOverlay
        visible={isDragging}
        title={t('pages.admin.eggConfigurations.dropzone.title', {})}
        subtitle={t('pages.admin.eggConfigurations.dropzone.subtitle', {})}
      />

      <Table
        columns={eggConfigurationTableColumns()}
        loading={loading}
        error={error}
        pagination={eggConfigurations}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
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
