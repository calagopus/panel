import { faFileArrowDown } from '@fortawesome/free-solid-svg-icons';
import { z } from 'zod';
import type { ContextMenuItem } from '@/elements/overlays/ContextMenu.tsx';
import { httpErrorToHuman } from '@/api/axios.ts';
import downloadBackup from '@/api/server/backups/downloadBackup.ts';
import { streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { downloadUrl } from '@/lib/network/url.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export function useBackupDownload(backup: z.infer<typeof serverBackupSchema>) {
  const { t } = useTranslations();
  const { addToast, addPendingToast } = useToast();
  const server = useServerStore((state) => state.server);

  const streaming = backup.kind === 'server' && backup.isStreaming;

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
    const pendingToast = addPendingToast(t('common.toast.preparingDownload', {}));

    return downloadBackup(server.uuid, backup.uuid, archiveFormat)
      .then(({ url }) => {
        pendingToast.settle(t('common.toast.downloadStarted', {}), 'success');
        downloadUrl(url, () => addToast(t('common.toast.downloadFailed', {}), 'error'));
      })
      .catch((msg) => {
        pendingToast.settle(httpErrorToHuman(msg), 'error');
      });
  };

  const formatItems: ContextMenuItem[] = streaming
    ? Object.entries(streamingArchiveFormatLabelMapping).map(([mime, label]) => ({
        type: 'action',
        icon: faFileArrowDown,
        label: t('common.button.downloadAs', { format: label }),
        onClick: () => doDownload(mime as z.infer<typeof streamingArchiveFormat>),
        color: 'gray',
      }))
    : [];

  return { streaming, doDownload, formatItems };
}
