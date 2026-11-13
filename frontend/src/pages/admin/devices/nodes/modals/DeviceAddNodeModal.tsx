import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import createNodeDevice from '@/api/admin/nodes/devices/createNodeDevice.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DeviceAddNodeModal({
  device,
  ...props
}: ModalProps & { device: z.infer<typeof adminDeviceSchema> }) {
  const { t } = useTranslations();

  const nodes = useInfiniteSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (page, search) => getNodes(page, search),
    canRequest: useAdminCan('nodes.read'),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.devices.tabs.nodes.page.modal.add.title', {})}
      label={t('common.form.node', {})}
      data={nodes.items.map((node) => ({ label: node.name, value: node.uuid }))}
      loading={nodes.loading}
      searchValue={nodes.search}
      onSearchChange={nodes.setSearch}
      infiniteScroll={nodes.infiniteScroll}
      addedToast={t('pages.admin.devices.tabs.nodes.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.deviceAssignments.all()]}
      onConfirm={(nodeUuid) => createNodeDevice(nodeUuid, device.uuid)}
    />
  );
}
