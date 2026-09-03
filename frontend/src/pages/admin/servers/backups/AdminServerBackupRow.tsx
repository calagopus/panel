import { faFileExport, faInfo, faRotateLeft, faTrash, faWarning } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import HljsCode from '@/elements/editors/HljsCode.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { BackupStatusCells, getBackupState, useBackupDownload } from '../../nodes/backups/backupRowShared.tsx';
import NodeBackupsDeleteModal from '../../nodes/backups/modals/NodeBackupsDeleteModal.tsx';
import NodeBackupsExportModal from '../../nodes/backups/modals/NodeBackupsExportModal.tsx';
import NodeBackupsRestoreModal from '../../nodes/backups/modals/NodeBackupsRestoreModal.tsx';

const loadJsonLanguage = () => import('highlight.js/lib/languages/json').then((mod) => mod.default);

export default function AdminServerBackupRow({
  server,
  backup,
}: {
  server: AdminServer;
  backup: z.infer<typeof adminNodeServerBackupSchema>;
}) {
  const { t } = useTranslations();
  const canManageBackups = useAdminCan('nodes.backups');

  const [openModal, setOpenModal] = useState<'restore' | 'export' | 'delete' | 'metadata' | null>(null);
  const metadataJson = useMemo(() => JSON.stringify(backup.metadata, null, 2), [backup.metadata]);

  const { downloadMenuItem } = useBackupDownload(
    backup.node.uuid,
    t('pages.admin.nodes.tabs.backups.page.toast.downloadStarted', {}),
  );

  const { isFailed, isDeleting, isDeleteFailed } = getBackupState(backup);
  const actionsHidden = !backup.completed || isFailed || isDeleting || isDeleteFailed;

  return (
    <>
      <NodeBackupsRestoreModal
        node={backup.node}
        backup={backup}
        opened={openModal === 'restore'}
        onClose={() => setOpenModal(null)}
      />
      <NodeBackupsExportModal
        node={backup.node}
        backup={backup}
        opened={openModal === 'export'}
        onClose={() => setOpenModal(null)}
      />
      <NodeBackupsDeleteModal
        node={backup.node}
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
          downloadMenuItem(backup, { hidden: actionsHidden, canAccess: canManageBackups }),
          {
            type: 'action',
            icon: faRotateLeft,
            label: t('common.button.restore', {}),
            hidden: actionsHidden,
            onClick: () => setOpenModal('restore'),
            color: 'gray',
            canAccess: canManageBackups,
          },
          {
            type: 'action',
            icon: faFileExport,
            label: t('pages.server.backups.button.exportToFiles', {}),
            hidden: actionsHidden,
            onClick: () => setOpenModal('export'),
            color: 'gray',
            canAccess: canManageBackups,
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
            label: t('common.button.delete', {}),
            hidden: !backup.completed || isDeleting,
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: canManageBackups,
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.backups.contextMenu}
        registryProps={{ server, backup }}
      >
        {({ items, openMenu }) => (
          <TableRow
            className={isDeleting ? 'opacity-50' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <div className='flex flex-row flex-wrap items-center gap-x-2 gap-y-1 whitespace-normal'>
                <span className='whitespace-nowrap'>{backup.name}</span>
                {backup.systemBackupPolicyUuid && (
                  <TableLink to={`/admin/system-backup-policies/${backup.systemBackupPolicyUuid}`}>
                    <Badge className='cursor-pointer!' color='blue'>
                      {t('common.badge.systemBackup', {})}
                    </Badge>
                  </TableLink>
                )}
              </div>
            </TableData>

            <TableData className='flex flex-row items-center'>
              <Code>
                <TableLink to={`/admin/nodes/${backup.node.uuid}`}>{backup.node.name}</TableLink>
              </Code>
              {backup.server && backup.server.node.uuid !== backup.node.uuid && (
                <Tooltip label={t('common.tooltip.backupOnDifferentNode', {})}>
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
