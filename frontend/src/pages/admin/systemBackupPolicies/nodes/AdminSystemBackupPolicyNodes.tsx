import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteSystemBackupPolicyNode from '@/api/admin/system-backup-policies/nodes/deleteSystemBackupPolicyNode.ts';
import getSystemBackupPolicyNodes from '@/api/admin/system-backup-policies/nodes/getSystemBackupPolicyNodes.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import ContextMenu from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import NodeRow from '@/pages/admin/nodes/NodeRow.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SystemBackupPolicyAddNodeModal from './modals/SystemBackupPolicyAddNodeModal.tsx';

function SystemBackupPolicyNodeRow({
  node,
  systemBackupPolicy,
  refetch,
}: {
  node: z.infer<typeof adminNodeSchema>;
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
  refetch: () => void;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteSystemBackupPolicyNode(systemBackupPolicy.uuid, node.uuid)
      .then(() => {
        addToast(t('pages.admin.systemBackupPolicies.tabs.nodes.page.toast.removed', {}), 'success');
        refetch();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'remove'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.systemBackupPolicies.tabs.nodes.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.systemBackupPolicies.tabs.nodes.page.modal.remove.content', {
          policy: systemBackupPolicy.name,
          name: node.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: useAdminCan('system-backup-policies.update'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.nodes.contextMenu}
        registryProps={{ systemBackupPolicy, node }}
      >
        {(props) => <NodeRow node={node} contextMenuProps={props} />}
      </ContextMenu>
    </>
  );
}

export default function AdminSystemBackupPolicyNodes({
  systemBackupPolicy,
}: {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: systemBackupPolicyNodes,
    loading,
    error,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.systemBackupPolicies.nodes(systemBackupPolicy.uuid),
    fetcher: (page, search) => getSystemBackupPolicyNodes(systemBackupPolicy.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.systemBackupPolicies.tabs.nodes.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.nodes.subContainer}
      registryProps={{ systemBackupPolicy }}
      contentRight={
        <AdminCan action='system-backup-policies.update'>
          <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action='system-backup-policies.update'>
        <SystemBackupPolicyAddNodeModal
          systemBackupPolicy={systemBackupPolicy}
          refetch={refetch}
          opened={openModal === 'add'}
          onClose={() => setOpenModal(null)}
        />
      </AdminCan>

      <Table
        columns={[...nodeTableColumns(), '']}
        loading={loading}
        pagination={systemBackupPolicyNodes}
        onPageSelect={setPage}
        error={error}
      >
        {systemBackupPolicyNodes?.data.map((systemBackupPolicyNode) => (
          <SystemBackupPolicyNodeRow
            key={systemBackupPolicyNode.node.uuid}
            node={systemBackupPolicyNode.node}
            systemBackupPolicy={systemBackupPolicy}
            refetch={refetch}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
