import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import getDevices from '@/api/admin/devices/getDevices.ts';
import createNodeDevice from '@/api/admin/nodes/devices/createNodeDevice.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeDeviceAddModal({ node, ...props }: ModalProps & { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();

  const devices = useInfiniteSearchableResource<z.infer<typeof adminDeviceSchema>>({
    queryKey: queryKeys.admin.devices.all(),
    fetcher: (page, search) => getDevices(page, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.nodes.tabs.devices.page.modal.add.title', {})}
      label={t('common.form.device', {})}
      data={devices.items.map((device) => ({ label: device.name, value: device.uuid }))}
      loading={devices.loading}
      searchValue={devices.search}
      onSearchChange={devices.setSearch}
      infiniteScroll={devices.infiniteScroll}
      addedToast={t('pages.admin.nodes.tabs.devices.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.deviceAssignments.all()]}
      onConfirm={(deviceUuid) => createNodeDevice(node.uuid, deviceUuid)}
    />
  );
}
