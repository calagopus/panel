import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import getDatabaseAgentHosts from '@/api/admin/database-agent-hosts/getDatabaseAgentHosts.ts';
import createSystemBackupPolicyDatabaseAgentHost from '@/api/admin/system-backup-policies/database-agent-hosts/createSystemBackupPolicyDatabaseAgentHost.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SystemBackupPolicyAddDatabaseAgentHostModal({
  systemBackupPolicy,
  refetch,
  ...props
}: ModalProps & { systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>; refetch: () => void }) {
  const { t } = useTranslations();

  const databaseAgentHosts = useSearchableResource<z.infer<typeof adminDatabaseAgentHostSchema>>({
    queryKey: queryKeys.admin.databaseAgentHosts.all(),
    fetcher: (search) => getDatabaseAgentHosts(1, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.systemBackupPolicies.tabs.databaseAgentHosts.page.modal.add.title', {})}
      label={t('common.form.databaseAgentHost', {})}
      data={databaseAgentHosts.items.map((host) => ({ label: host.name, value: host.uuid }))}
      loading={databaseAgentHosts.loading}
      searchValue={databaseAgentHosts.search}
      onSearchChange={databaseAgentHosts.setSearch}
      addedToast={t('pages.admin.systemBackupPolicies.tabs.databaseAgentHosts.page.toast.added', {})}
      onAdded={refetch}
      onConfirm={(databaseAgentHostUuid) =>
        createSystemBackupPolicyDatabaseAgentHost(systemBackupPolicy.uuid, databaseAgentHostUuid)
      }
    />
  );
}
