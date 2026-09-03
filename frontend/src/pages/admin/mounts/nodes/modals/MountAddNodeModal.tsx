import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import createNodeMount from '@/api/admin/nodes/mounts/createNodeMount.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MountAddNodeModal({
  mount,
  ...props
}: ModalProps & { mount: z.infer<typeof adminMountSchema> }) {
  const { t } = useTranslations();

  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (search) => getNodes(1, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.mounts.tabs.nodes.page.modal.add.title', {})}
      label={t('common.form.node', {})}
      data={nodes.items.map((node) => ({ label: node.name, value: node.uuid }))}
      loading={nodes.loading}
      searchValue={nodes.search}
      onSearchChange={nodes.setSearch}
      addedToast={t('pages.admin.mounts.tabs.nodes.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.mountAssignments.all()]}
      onConfirm={(nodeUuid) => createNodeMount(nodeUuid, mount.uuid)}
    />
  );
}
