import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import getDatabaseHosts from '@/api/admin/database-hosts/getDatabaseHosts.ts';
import createLocationDatabaseHost from '@/api/admin/locations/database-hosts/createLocationDatabaseHost.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { groupDatabaseHostsByType } from '@/lib/domain/database.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function LocationDatabaseHostCreateModal({
  location,
  ...props
}: ModalProps & { location: z.infer<typeof adminLocationSchema> }) {
  const { t } = useTranslations();

  const databaseHosts = useSearchableResource<z.infer<typeof adminDatabaseHostSchema>>({
    queryKey: queryKeys.admin.databaseHosts.all(),
    fetcher: (search) => getDatabaseHosts(1, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.locations.tabs.databaseHosts.page.modal.create.title', {})}
      label={t('common.form.databaseHost', {})}
      data={Object.values(groupDatabaseHostsByType(databaseHosts.items))}
      loading={databaseHosts.loading}
      searchValue={databaseHosts.search}
      onSearchChange={databaseHosts.setSearch}
      confirmLabel={t('common.button.create', {})}
      addedToast={t('pages.admin.locations.tabs.databaseHosts.page.toast.created', {})}
      invalidateKeys={[queryKeys.admin.locations.databaseHosts(location.uuid)]}
      onConfirm={(hostUuid) => createLocationDatabaseHost(location.uuid, hostUuid)}
    />
  );
}
