import { faFileArrowDown, faFileExport, faRotateLeft, faTrash, faWarning } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import downloadNodeBackup from '@/api/admin/nodes/backups/downloadNodeBackup.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Badge from '@/elements/Badge.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { bytesToString } from '@/lib/size.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeBackupsDeleteModal from './modals/NodeBackupsDeleteModal.tsx';
import NodeBackupsExportModal from './modals/NodeBackupsExportModal.tsx';
import NodeBackupsRestoreModal from './modals/NodeBackupsRestoreModal.tsx';

type Props<P> = {
  backup: z.infer<typeof adminNodeServerBackupSchema>;
  downloadStartedMessage: string;
} & ({ registry: ContextMenuRegistry<P>; registryProps: P } | { registry?: never; registryProps?: never });

export default function NodeServerBackupRow<P>({ backup, downloadStartedMessage, ...contextMenu }: Props<P>) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'restore' | 'export' | 'delete' | null>(null);

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
    downloadNodeBackup(backup.node.uuid, backup.uuid, archiveFormat)
      .then(({ url }) => {
        addToast(downloadStartedMessage, 'success');
        window.location.href = url;
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const isFailed = !backup.isSuccessful && !!backup.completed;
  const isDeleting = backup.deletionStatus === 'deleting';
  const isDeleteFailed = backup.deletionStatus === 'failed';

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
          {
            type: 'action',
            icon: faFileArrowDown,
            label: t('common.button.download', {}),
            hidden: !backup.completed || isFailed || isDeleting || isDeleteFailed,
            onClick: !backup.isStreaming ? () => doDownload('tar_gz') : undefined,
            color: 'gray',
            items: backup.isStreaming
              ? Object.entries(streamingArchiveFormatLabelMapping).map(([mime, label]) => ({
                  type: 'action',
                  icon: faFileArrowDown,
                  label: t('common.button.downloadAs', { format: label }),
                  onClick: () => doDownload(mime as z.infer<typeof streamingArchiveFormat>),
                  color: 'gray',
                }))
              : [],
            canAccess: useAdminCan('nodes.backups'),
          },
          {
            type: 'action',
            icon: faRotateLeft,
            label: t('common.button.restore', {}),
            hidden: !backup.completed || isFailed || isDeleting || isDeleteFailed,
            onClick: () => setOpenModal('restore'),
            color: 'gray',
            canAccess: useAdminCan('nodes.backups'),
          },
          {
            type: 'action',
            icon: faFileExport,
            label: t('pages.server.backups.button.exportToFiles', {}),
            hidden: !backup.completed || isFailed || isDeleting || isDeleteFailed,
            onClick: () => setOpenModal('export'),
            color: 'gray',
            canAccess: useAdminCan('nodes.backups'),
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            hidden: !backup.completed || isDeleting,
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: useAdminCan('nodes.backups'),
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

            {isDeleting || isDeleteFailed ? (
              <TableData colSpan={3}>
                {isDeleting ? (
                  <Badge color='yellow'>{t('pages.server.backups.badge.deleting', {})}</Badge>
                ) : (
                  <Badge color='red'>{t('pages.server.backups.badge.deleteFailed', {})}</Badge>
                )}
              </TableData>
            ) : !isFailed ? (
              <>
                <TableData>{backup.checksum && <Code>{backup.checksum}</Code>}</TableData>

                {backup.completed ? (
                  <TableData>{bytesToString(backup.bytes)}</TableData>
                ) : (
                  <TableData colSpan={2}>
                    <Spinner size={16} />
                  </TableData>
                )}

                {backup.completed ? <TableData>{backup.files}</TableData> : null}
              </>
            ) : (
              <TableData colSpan={3}>
                <Badge color='red'>{t('common.badge.failed', {})}</Badge>
              </TableData>
            )}

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
