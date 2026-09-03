import { faFileExport, faInfo, faLink, faRotateLeft, faTrash, faWarning } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import detachNodeBackup from '@/api/admin/nodes/backups/detachNodeBackup.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import HljsCode from '@/elements/editors/HljsCode.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema } from '@/lib/schemas/admin/servers.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { BackupStatusCells, getBackupState, useBackupDownload } from './backupRowShared.tsx';
import NodeBackupsDeleteModal from './modals/NodeBackupsDeleteModal.tsx';
import NodeBackupsExportModal from './modals/NodeBackupsExportModal.tsx';
import NodeBackupsReattachModal from './modals/NodeBackupsReattachModal.tsx';
import NodeBackupsRestoreModal from './modals/NodeBackupsRestoreModal.tsx';

const loadJsonLanguage = () => import('highlight.js/lib/languages/json').then((mod) => mod.default);

export default function NodeBackupRow({
  node,
  backup,
}: {
  node: AdminNode;
  backup: z.infer<typeof adminServerBackupSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const canBackups = useAdminCan('nodes.backups');
  const { downloadMenuItem } = useBackupDownload(
    node.uuid,
    t('pages.admin.nodes.tabs.backups.page.toast.downloadStarted', {}),
  );

  const [openModal, setOpenModal] = useState<
    'restore' | 'export' | 'reattach' | 'detach' | 'delete' | 'metadata' | null
  >(null);
  const metadataJson = useMemo(() => JSON.stringify(backup.metadata, null, 2), [backup.metadata]);

  const doDetach = async () => {
    await detachNodeBackup(node.uuid, backup.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.admin.nodes.tabs.backups.page.toast.detached', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.backups.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const { isFailed, isDeleting, isDeleteFailed } = getBackupState(backup);
  const actionsHidden = !backup.completed || isFailed || isDeleting || isDeleteFailed;

  return (
    <>
      <NodeBackupsRestoreModal
        node={node}
        backup={backup}
        opened={openModal === 'restore'}
        onClose={() => setOpenModal(null)}
      />
      <NodeBackupsExportModal
        node={node}
        backup={backup}
        opened={openModal === 'export'}
        onClose={() => setOpenModal(null)}
      />
      <NodeBackupsReattachModal
        node={node}
        backup={backup}
        opened={openModal === 'reattach'}
        onClose={() => setOpenModal(null)}
      />
      <ConfirmationModal
        opened={openModal === 'detach'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.nodes.tabs.backups.page.modal.detach.title', {})}
        confirm={t('common.button.continue', {})}
        onConfirmed={doDetach}
      >
        {t('pages.admin.nodes.tabs.backups.page.modal.detach.content', {})}
      </ConfirmationModal>
      <NodeBackupsDeleteModal
        node={node}
        backup={backup}
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
      />

      <Modal
        title={t('pages.server.backups.modal.viewMetadata.title', {})}
        onClose={() => setOpenModal(null)}
        opened={openModal === 'metadata'}
      >
        <HljsCode languageName='json' language={loadJsonLanguage}>
          {metadataJson}
        </HljsCode>

        <ModalFooter>
          <Button variant='default' onClick={() => setOpenModal(null)}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Modal>

      <ContextMenu
        items={[
          downloadMenuItem(backup, { hidden: actionsHidden, canAccess: canBackups }),
          {
            type: 'action',
            icon: faRotateLeft,
            label: t('common.button.restore', {}),
            hidden: actionsHidden,
            onClick: () => setOpenModal('restore'),
            color: 'gray',
            canAccess: canBackups,
          },
          {
            type: 'action',
            icon: faFileExport,
            label: t('pages.server.backups.button.exportToFiles', {}),
            hidden: actionsHidden,
            onClick: () => setOpenModal('export'),
            color: 'gray',
            canAccess: canBackups,
          },
          {
            type: 'action',
            icon: faLink,
            label: t('common.button.reattach', {}),
            hidden: actionsHidden,
            onClick: () => setOpenModal('reattach'),
            color: 'gray',
            canAccess: canBackups,
          },
          {
            type: 'action',
            icon: faLink,
            label: t('common.button.detach', {}),
            hidden: actionsHidden || !backup.server,
            onClick: () => setOpenModal('detach'),
            color: 'gray',
            canAccess: canBackups,
          },
          {
            type: 'action',
            icon: faInfo,
            label: t('pages.server.backups.modal.viewMetadata.title', {}),
            hidden: Object.keys(backup.metadata).length === 0,
            onClick: () => setOpenModal('metadata'),
            color: 'gray',
          },
          {
            type: 'action',
            icon: faTrash,
            hidden: !backup.completed || isDeleting,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: canBackups,
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.backups.contextMenu}
        registryProps={{ node, backup }}
      >
        {({ items, openMenu }) => (
          <TableRow
            className={isDeleting ? 'opacity-50' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>{backup.name}</TableData>

            <TableData className='flex flex-row items-center'>
              <Code>
                {backup.server ? (
                  <TableLink to={`/admin/servers/${backup.server.uuid}`}>{backup.server.name}</TableLink>
                ) : (
                  t('common.na', {})
                )}
              </Code>
              {backup.server && backup.server.node.uuid !== node.uuid && (
                <Tooltip label={t('pages.admin.nodes.tabs.backups.page.tooltip.backupNotOnSameNode', {})}>
                  <FontAwesomeIcon icon={faWarning} className='ml-1 text-yellow-400' />
                </Tooltip>
              )}
            </TableData>

            <BackupStatusCells backup={backup} />

            <TableData>
              <FormattedTimestamp timestamp={backup.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
