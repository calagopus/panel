import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import getMounts from '@/api/admin/mounts/getMounts.ts';
import createNodeMount from '@/api/admin/nodes/mounts/createNodeMount.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeMountAddModal({ node, ...props }: ModalProps & { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();

  const mounts = useSearchableResource<z.infer<typeof adminMountSchema>>({
    queryKey: queryKeys.admin.mounts.all(),
    fetcher: (search) => getMounts(1, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.nodes.tabs.mounts.page.modal.add.title', {})}
      label={t('common.form.mount', {})}
      data={mounts.items.map((mount) => ({ label: mount.name, value: mount.uuid }))}
      loading={mounts.loading}
      searchValue={mounts.search}
      onSearchChange={mounts.setSearch}
      addedToast={t('pages.admin.nodes.tabs.mounts.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.mountAssignments.all()]}
      onConfirm={(mountUuid) => createNodeMount(node.uuid, mountUuid)}
    />
  );
}
