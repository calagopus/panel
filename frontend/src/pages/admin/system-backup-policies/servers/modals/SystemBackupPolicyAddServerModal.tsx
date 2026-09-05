import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import getServers from '@/api/admin/servers/getServers.ts';
import createSystemBackupPolicyServer from '@/api/admin/system-backup-policies/servers/createSystemBackupPolicyServer.ts';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SystemBackupPolicyAddServerModal({
  systemBackupPolicy,
  refetch,
  ...props
}: ModalProps & { systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>; refetch: () => void }) {
  const { t } = useTranslations();

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.systemBackupPolicies.tabs.servers.page.modal.add.title', {})}
      label={t('common.form.server', {})}
      addedToast={t('pages.admin.systemBackupPolicies.tabs.servers.page.toast.added', {})}
      onAdded={refetch}
      onConfirm={(serverUuid) => createSystemBackupPolicyServer(systemBackupPolicy.uuid, serverUuid)}
      renderSelect={({ value, onChange }) => (
        <ServerSelect<z.infer<typeof adminServerSchema>>
          withAsterisk
          label={t('common.form.server', {})}
          placeholder={t('common.form.server', {})}
          queryKey={queryKeys.admin.servers.all()}
          fetcher={(search) => getServers(1, search)}
          value={value}
          onChange={(uuid) => onChange(uuid)}
        />
      )}
    />
  );
}
