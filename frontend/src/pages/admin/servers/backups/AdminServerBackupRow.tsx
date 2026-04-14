import { faFileArrowDown, faRotateLeft, faTrash, faWarning } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { z } from 'zod';
import downloadNodeBackup from '@/api/admin/nodes/backups/downloadNodeBackup.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Badge from '@/elements/Badge.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { bytesToString } from '@/lib/size.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeBackupsDeleteModal from '../../nodes/backups/modals/NodeBackupsDeleteModal.tsx';
import NodeBackupsRestoreModal from '../../nodes/backups/modals/NodeBackupsRestoreModal.tsx';

export default function AdminServerBackupRow({ backup }: { backup: z.infer<typeof adminNodeServerBackupSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'restore' | 'delete' | null>(null);

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
    downloadNodeBackup(backup.node.uuid, backup.uuid, archiveFormat)
      .then(({ url }) => {
        addToast('Download started.', 'success');
        window.open(url, '_blank');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const isFailed = !backup.isSuccessful && !!backup.completed;

  return (
    <>
      <NodeBackupsRestoreModal
        node={backup.node}
        backup={backup}
        opened={openModal === 'restore'}
        onClose={() => setOpenModal(null)}
      />
      <NodeBackupsDeleteModal
        node={backup.node}
        backup={backup}
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenu
        items={[
          {
            icon: faFileArrowDown,
            label: t('common.button.download', {}),
            hidden: !backup.completed || isFailed,
            onClick: !backup.isStreaming ? () => doDownload('tar_gz') : undefined,
            color: 'gray',
            items: backup.isStreaming
              ? Object.entries(streamingArchiveFormatLabelMapping).map(([mime, label]) => ({
                  icon: faFileArrowDown,
                  label: t('common.button.downloadAs', { format: label }),
                  onClick: () => doDownload(mime as z.infer<typeof streamingArchiveFormat>),
                  color: 'gray',
                }))
              : [],
            canAccess: useAdminCan('nodes.backups'),
          },
          {
            icon: faRotateLeft,
            label: t('common.button.restore', {}),
            hidden: !backup.completed || isFailed,
            onClick: () => setOpenModal('restore'),
            color: 'gray',
            canAccess: useAdminCan('nodes.backups'),
          },
          {
            icon: faTrash,
            label: t('common.button.delete', {}),
            hidden: !backup.completed,
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: useAdminCan('nodes.backups'),
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.pageX, e.pageY);
            }}
          >
            <TableData>{backup.name}</TableData>

            <TableData className='flex flex-row items-center'>
              <Code>
                <NavLink
                  to={`/admin/nodes/${backup.node.uuid}`}
                  className='text-blue-400 hover:text-blue-200 hover:underline'
                >
                  {backup.node.name}
                </NavLink>
              </Code>
              {backup.server && backup.server.node.uuid !== backup.node.uuid && (
                <Tooltip label='This backup is on a different node than the server. It is not viewable from the Client API.'>
                  <FontAwesomeIcon icon={faWarning} className='ml-1 text-yellow-400' />
                </Tooltip>
              )}
            </TableData>

            {!isFailed ? (
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
