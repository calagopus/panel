import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteSystemBackupPolicyDatabaseAgentHost from '@/api/admin/system-backup-policies/database-agent-hosts/deleteSystemBackupPolicyDatabaseAgentHost.ts';
import getSystemBackupPolicyDatabaseAgentHosts from '@/api/admin/system-backup-policies/database-agent-hosts/getSystemBackupPolicyDatabaseAgentHosts.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table, { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { systemBackupPolicyDatabaseAgentHostTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SystemBackupPolicyAddDatabaseAgentHostModal from './modals/SystemBackupPolicyAddDatabaseAgentHostModal.tsx';

function SystemBackupPolicyDatabaseAgentHostRow({
  databaseAgentHost,
  added,
  systemBackupPolicy,
  canRemove,
  refetch,
}: {
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
  added: Date;
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
  canRemove: boolean;
  refetch: () => void;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteSystemBackupPolicyDatabaseAgentHost(systemBackupPolicy.uuid, databaseAgentHost.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.admin.systemBackupPolicies.tabs.databaseAgentHosts.page.toast.removed', {}), 'success');
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
        title={t('pages.admin.systemBackupPolicies.tabs.databaseAgentHosts.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.systemBackupPolicies.tabs.databaseAgentHosts.page.modal.remove.content', {
          policy: systemBackupPolicy.name,
          name: databaseAgentHost.name,
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
            canAccess: canRemove,
          },
        ]}
        registry={
          window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.databaseAgentHosts.contextMenu
        }
        registryProps={{ systemBackupPolicy, databaseAgentHost }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <TableLink to={`/admin/database-agent-hosts/${databaseAgentHost.uuid}`}>
                <Code>{databaseAgentHost.uuid}</Code>
              </TableLink>
            </TableData>

            <TableData>{databaseAgentHost.name}</TableData>

            <TableData>
              <FormattedTimestamp timestamp={added} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}

export default function AdminSystemBackupPolicyDatabaseAgentHosts({
  systemBackupPolicy,
}: {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
}) {
  const { t } = useTranslations();
  const canUpdate = useAdminCan('system-backup-policies.update');
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: systemBackupPolicyDatabaseAgentHosts,
    loading,
    error,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.systemBackupPolicies.databaseAgentHosts(systemBackupPolicy.uuid),
    fetcher: (page, search) => getSystemBackupPolicyDatabaseAgentHosts(systemBackupPolicy.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.systemBackupPolicies.tabs.databaseAgentHosts.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={
        window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.databaseAgentHosts.subContainer
      }
      registryProps={{ systemBackupPolicy }}
      contentRight={
        canUpdate ? (
          <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        ) : undefined
      }
    >
      {canUpdate && (
        <SystemBackupPolicyAddDatabaseAgentHostModal
          systemBackupPolicy={systemBackupPolicy}
          refetch={refetch}
          opened={openModal === 'add'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <Table
        columns={systemBackupPolicyDatabaseAgentHostTableColumns()}
        loading={loading}
        pagination={systemBackupPolicyDatabaseAgentHosts}
        onPageSelect={setPage}
        error={error}
      >
        {systemBackupPolicyDatabaseAgentHosts?.data.map((systemBackupPolicyDatabaseAgentHost) => (
          <SystemBackupPolicyDatabaseAgentHostRow
            key={systemBackupPolicyDatabaseAgentHost.databaseAgentHost.uuid}
            databaseAgentHost={systemBackupPolicyDatabaseAgentHost.databaseAgentHost}
            added={systemBackupPolicyDatabaseAgentHost.created}
            systemBackupPolicy={systemBackupPolicy}
            canRemove={canUpdate}
            refetch={refetch}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
