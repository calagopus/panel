import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import getMounts from '@/api/admin/mounts/getMounts.ts';
import createEggMount from '@/api/admin/nests/eggs/mounts/createEggMount.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggMountAddModal({
  nest,
  egg,
  ...props
}: ModalProps & { nest: z.infer<typeof adminNestSchema>; egg: z.infer<typeof adminEggSchema> }) {
  const { t } = useTranslations();

  const mounts = useSearchableResource<z.infer<typeof adminMountSchema>>({
    queryKey: queryKeys.admin.mounts.all(),
    fetcher: (search) => getMounts(1, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.nests.tabs.eggs.page.tabs.mounts.page.modal.add.title', {})}
      label={t('common.form.mount', {})}
      data={mounts.items.map((mount) => ({ label: mount.name, value: mount.uuid }))}
      loading={mounts.loading}
      searchValue={mounts.search}
      onSearchChange={mounts.setSearch}
      addedToast={t('pages.admin.nests.tabs.eggs.page.tabs.mounts.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.mountAssignments.all()]}
      onConfirm={(mountUuid) => createEggMount(nest.uuid, egg.uuid, mountUuid)}
    />
  );
}
