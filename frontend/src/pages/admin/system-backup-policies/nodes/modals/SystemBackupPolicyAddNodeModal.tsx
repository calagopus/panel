import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import createSystemBackupPolicyNode from '@/api/admin/system-backup-policies/nodes/createSystemBackupPolicyNode.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SystemBackupPolicyAddNodeModal({
  systemBackupPolicy,
  refetch,
  ...props
}: ModalProps & { systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>; refetch: () => void }) {
  const { t } = useTranslations();

  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (search) => getNodes(1, search),
  });

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.systemBackupPolicies.tabs.nodes.page.modal.add.title', {})}
      label={t('common.form.node', {})}
      data={nodes.items.map((node) => ({ label: node.name, value: node.uuid }))}
      loading={nodes.loading}
      searchValue={nodes.search}
      onSearchChange={nodes.setSearch}
      addedToast={t('pages.admin.systemBackupPolicies.tabs.nodes.page.toast.added', {})}
      onAdded={refetch}
      onConfirm={(nodeUuid) => createSystemBackupPolicyNode(systemBackupPolicy.uuid, nodeUuid)}
    />
  );
}
