import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import getServerDevices from '@/api/admin/servers/devices/getServerDevices.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { serverDeviceTableColumns } from '@/lib/tableColumns.ts';
import ServerDeviceAddModal from '@/pages/admin/servers/devices/modals/ServerDeviceAddModal.tsx';
import ServerDeviceRow from '@/pages/admin/servers/devices/ServerDeviceRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminServerDevices({ server }: { server: AdminServer }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: serverDevices,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.deviceAssignments.devicesByServer(server.uuid),
    fetcher: (page, search, perPage) => getServerDevices(server.uuid, page, search, perPage),
    backgroundRefetch: true,
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.devices.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('common.button.add', {})}
        </Button>
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.devices.subContainer}
      registryProps={{ server }}
    >
      <ServerDeviceAddModal server={server} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />

      <Table
        columns={serverDeviceTableColumns()}
        loading={loading}
        pagination={serverDevices}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {serverDevices?.data.map((device) => (
          <ServerDeviceRow key={device.device.uuid} server={server} device={device} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
