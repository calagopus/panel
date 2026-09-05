import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import createServerMount from '@/api/admin/servers/mounts/createServerMount.ts';
import getAvailableServerMounts from '@/api/admin/servers/mounts/getAvailableServerMounts.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer, adminServerMountSchema } from '@/lib/schemas/admin/servers.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerMountAddModal({ server, ...props }: ModalProps & { server: AdminServer }) {
  const { t } = useTranslations();

  const mounts = useSearchableResource<z.infer<typeof adminServerMountSchema>>({
    queryKey: queryKeys.admin.mountAssignments.availableMountsByServer(server.uuid),
    fetcher: (search) => getAvailableServerMounts(server.uuid, 1, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.servers.tabs.mounts.page.modal.add.title', {})}
      label={t('common.form.mount', {})}
      data={mounts.items.map((mount) => ({ label: mount.mount.name, value: mount.mount.uuid }))}
      loading={mounts.loading}
      searchValue={mounts.search}
      onSearchChange={mounts.setSearch}
      addedToast={t('pages.admin.servers.tabs.mounts.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.mountAssignments.all()]}
      onConfirm={(mountUuid) => createServerMount(server.uuid, { mountUuid })}
    />
  );
}
