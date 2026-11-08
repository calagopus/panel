import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import createServerDevice from '@/api/admin/servers/devices/createServerDevice.ts';
import getAvailableServerDevices from '@/api/admin/servers/devices/getAvailableServerDevices.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer, adminServerDeviceSchema } from '@/lib/schemas/admin/servers.ts';
import NodeAllowedSourceAlert from '@/pages/admin/nodes/NodeAllowedSourceAlert.tsx';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerDeviceAddModal({ server, ...props }: ModalProps & { server: AdminServer }) {
  const { t } = useTranslations();

  const devices = useInfiniteSearchableResource<z.infer<typeof adminServerDeviceSchema>>({
    queryKey: queryKeys.admin.deviceAssignments.availableDevicesByServer(server.uuid),
    fetcher: (page, search) => getAvailableServerDevices(server.uuid, page, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.servers.tabs.devices.page.modal.add.title', {})}
      label={t('common.form.device', {})}
      data={devices.items.map((device) => ({ label: device.device.name, value: device.device.uuid }))}
      loading={devices.loading}
      searchValue={devices.search}
      onSearchChange={devices.setSearch}
      infiniteScroll={devices.infiniteScroll}
      renderBelowSelect={(value) => <NodeAllowedSourceAlert nodeUuid={server.node.uuid} kind='device' uuid={value} />}
      addedToast={t('pages.admin.servers.tabs.devices.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.deviceAssignments.all()]}
      onConfirm={(deviceUuid) => createServerDevice(server.uuid, { deviceUuid })}
    />
  );
}
