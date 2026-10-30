import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getDevices from '@/api/admin/devices/getDevices.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { deviceTableColumns } from '@/lib/tableColumns.ts';
import DeviceView from '@/pages/admin/devices/DeviceView.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import DeviceCreateOrUpdate from './DeviceCreateOrUpdate.tsx';
import DeviceRow from './DeviceRow.tsx';

function DevicesContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();

  const {
    data: devices,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.devices.all(),
    fetcher: getDevices,
    backgroundRefetch: true,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.devices.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.admin.devices.container}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='devices.create'>
          <Button
            onClick={() => navigate('/admin/devices/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>
        </AdminCan>
      }
    >
      <Table
        columns={deviceTableColumns()}
        loading={loading}
        pagination={devices}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {devices?.data.map((d) => (
          <DeviceRow key={d.uuid} device={d} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminDevices() {
  return (
    <Routes>
      <Route path='/' element={<DevicesContainer />} />
      <Route path='/:id/*' element={<DeviceView />} />
      <Route element={<AdminPermissionGuard permission='devices.create' />}>
        <Route path='/new' element={<DeviceCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
