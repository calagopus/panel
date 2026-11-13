import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import getDatabaseHosts from '@/api/admin/database-hosts/getDatabaseHosts.ts';
import createNodeDatabaseHost from '@/api/admin/nodes/database-hosts/createNodeDatabaseHost.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { groupDatabaseHostsByType } from '@/lib/domain/database.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeDatabaseHostCreateModal({
  node,
  ...props
}: ModalProps & { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();

  const databaseHosts = useInfiniteSearchableResource<z.infer<typeof adminDatabaseHostSchema>>({
    queryKey: queryKeys.admin.databaseHosts.all(),
    fetcher: (page, search) => getDatabaseHosts(page, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      nothingFoundMessage={t('elements.resourceSelectModal.empty.databaseHosts', {})}
      createAction={{ to: '/admin/database-hosts/new', permission: 'database-hosts.create' }}
      title={t('pages.admin.nodes.tabs.databaseHosts.page.modal.create.title', {})}
      label={t('common.form.databaseHost', {})}
      data={Object.values(groupDatabaseHostsByType(databaseHosts.items))}
      loading={databaseHosts.loading}
      searchValue={databaseHosts.search}
      onSearchChange={databaseHosts.setSearch}
      infiniteScroll={databaseHosts.infiniteScroll}
      confirmLabel={t('common.button.create', {})}
      addedToast={t('pages.admin.nodes.tabs.databaseHosts.page.toast.created', {})}
      invalidateKeys={[queryKeys.admin.nodes.databaseHosts(node.uuid)]}
      onConfirm={(hostUuid) => createNodeDatabaseHost(node.uuid, hostUuid)}
    />
  );
}
