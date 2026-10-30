import { z } from 'zod';
import getDeviceServers from '@/api/admin/devices/servers/getDeviceServers.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ServerRow from '../../servers/ServerRow.tsx';

export default function AdminDeviceServers({ device }: { device: z.infer<typeof adminDeviceSchema> }) {
  const { t } = useTranslations();
  const {
    data: deviceServers,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.deviceAssignments.serversByDevice(device.uuid),
    fetcher: (page, search, perPage) => getDeviceServers(device.uuid, page, search, perPage),
    backgroundRefetch: true,
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.devices.tabs.servers.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.devices.view.servers.subContainer}
      registryProps={{ device }}
    >
      <Table
        columns={serverTableColumns()}
        loading={loading}
        pagination={deviceServers}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {deviceServers?.data.map((serverDevice) => (
          <ServerRow key={serverDevice.server.uuid} server={serverDevice.server} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
