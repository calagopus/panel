import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import getLocations from '@/api/admin/locations/getLocations.ts';
import createSystemBackupPolicyLocation from '@/api/admin/system-backup-policies/locations/createSystemBackupPolicyLocation.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SystemBackupPolicyAddLocationModal({
  systemBackupPolicy,
  refetch,
  ...props
}: ModalProps & { systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>; refetch: () => void }) {
  const { t } = useTranslations();

  const locations = useSearchableResource<z.infer<typeof adminLocationSchema>>({
    queryKey: queryKeys.admin.locations.all(),
    fetcher: (search) => getLocations(1, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.systemBackupPolicies.tabs.locations.page.modal.add.title', {})}
      label={t('common.form.location', {})}
      data={locations.items.map((location) => ({ label: location.name, value: location.uuid }))}
      loading={locations.loading}
      searchValue={locations.search}
      onSearchChange={locations.setSearch}
      addedToast={t('pages.admin.systemBackupPolicies.tabs.locations.page.toast.added', {})}
      onAdded={refetch}
      onConfirm={(locationUuid) => createSystemBackupPolicyLocation(systemBackupPolicy.uuid, locationUuid)}
    />
  );
}
