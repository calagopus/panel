import { faFileArrowDown } from '@fortawesome/free-solid-svg-icons';
import { z } from 'zod';
import downloadNodeBackup from '@/api/admin/nodes/backups/downloadNodeBackup.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData } from '@/elements/data-display/Table.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import type { ContextMenuActionItem } from '@/elements/overlays/ContextMenu.tsx';
import Code from '@/elements/typography/Code.tsx';
import { streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { adminServerBackupSchema } from '@/lib/schemas/admin/servers.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type ServerBackup = z.infer<typeof adminServerBackupSchema>;
type ArchiveFormat = z.infer<typeof streamingArchiveFormat>;

export function getBackupState(backup: Pick<ServerBackup, 'isSuccessful' | 'completed' | 'deletionStatus'>) {
  return {
    isFailed: !backup.isSuccessful && !!backup.completed,
    isDeleting: backup.deletionStatus === 'deleting',
    isDeleteFailed: backup.deletionStatus === 'failed',
  };
}

export function BackupStatusCells({ backup }: { backup: ServerBackup }) {
  const { t } = useTranslations();
  const { isFailed, isDeleting, isDeleteFailed } = getBackupState(backup);

  if (isDeleting || isDeleteFailed) {
    return (
      <TableData colSpan={3}>
        {isDeleting ? (
          <Badge color='yellow'>{t('pages.server.backups.badge.deleting', {})}</Badge>
        ) : (
          <Badge color='red'>{t('pages.server.backups.badge.deleteFailed', {})}</Badge>
        )}
      </TableData>
    );
  }

  if (isFailed) {
    return (
      <TableData colSpan={3}>
        <Badge color='red'>{t('common.badge.failed', {})}</Badge>
      </TableData>
    );
  }

  return (
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
  );
}

export function useBackupDownload(nodeUuid: string, downloadStartedMessage: string) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const doDownload = (backupUuid: string, archiveFormat: ArchiveFormat) => {
    downloadNodeBackup(nodeUuid, backupUuid, archiveFormat)
      .then(({ url }) => {
        addToast(downloadStartedMessage, 'success');
        window.location.href = url;
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const downloadMenuItem = (
    backup: ServerBackup,
    options: { hidden: boolean; canAccess?: boolean },
  ): ContextMenuActionItem => ({
    type: 'action',
    icon: faFileArrowDown,
    label: t('common.button.download', {}),
    hidden: options.hidden,
    onClick: !backup.isStreaming ? () => doDownload(backup.uuid, 'tar_gz') : undefined,
    color: 'gray',
    items: backup.isStreaming
      ? Object.entries(streamingArchiveFormatLabelMapping).map(([mime, label]) => ({
          type: 'action',
          icon: faFileArrowDown,
          label: t('common.button.downloadAs', { format: label }),
          onClick: () => doDownload(backup.uuid, mime as ArchiveFormat),
          color: 'gray',
        }))
      : [],
    canAccess: options.canAccess,
  });

  return { doDownload, downloadMenuItem };
}
