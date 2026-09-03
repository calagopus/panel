import { faFileExport, faRotateLeft, faTrash, faWarning } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { BackupStatusCells, getBackupState, useBackupDownload } from './backupRowShared.tsx';
import NodeBackupsDeleteModal from './modals/NodeBackupsDeleteModal.tsx';
import NodeBackupsExportModal from './modals/NodeBackupsExportModal.tsx';
import NodeBackupsRestoreModal from './modals/NodeBackupsRestoreModal.tsx';

type Props<P> = {
  backup: z.infer<typeof adminNodeServerBackupSchema>;
  downloadStartedMessage: string;
} & ({ registry: ContextMenuRegistry<P>; registryProps: P } | { registry?: never; registryProps?: never });

export default function NodeServerBackupRow<P>({ backup, downloadStartedMessage, ...contextMenu }: Props<P>) {
  const { t } = useTranslations();
  const canBackups = useAdminCan('nodes.backups');
  const { downloadMenuItem } = useBackupDownload(backup.node.uuid, downloadStartedMessage);

  const [openModal, setOpenModal] = useState<'restore' | 'export' | 'delete' | null>(null);

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

      <ContextMenu<P>
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
            icon: faTrash,
            label: t('common.button.delete', {}),
            hidden: !backup.completed || isDeleting,
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: canBackups,
          },
        ]}
        {...contextMenu}
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

            <TableData>
              <Code>
                {backup.server ? (
                  <TableLink to={`/admin/servers/${backup.server.uuid}`}>{backup.server.name}</TableLink>
                ) : (
                  t('common.na', {})
                )}
              </Code>
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
