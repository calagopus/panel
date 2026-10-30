import { faFileArrowDown } from '@fortawesome/free-solid-svg-icons';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import { ContextMenuItem } from '@/elements/overlays/ContextMenu.tsx';
import { streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { downloadUrl } from '@/lib/network/url.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { AddToast, PendingToast } from '@/providers/contexts/toastContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type TFunc = ReturnType<typeof useTranslations>['t'];

export function downloadFilesWithToast(
  request: Promise<{ url: string }>,
  {
    addToast,
    addPendingToast,
    t,
  }: { addToast: AddToast; addPendingToast: (message: string) => PendingToast; t: TFunc },
): Promise<void> {
  const pendingToast = addPendingToast(t('common.toast.preparingDownload', {}));

  return request
    .then(({ url }) => {
      pendingToast.settle(t('pages.server.files.toast.downloadStarted', {}), 'success');
      downloadUrl(url, () => addToast(t('common.toast.downloadFailed', {}), 'error'));
    })
    .catch((msg) => {
      pendingToast.settle(httpErrorToHuman(msg), 'error');
    });
}

export function buildDownloadAsMenuItems(
  t: TFunc,
  onSelect: (archiveFormat: z.infer<typeof streamingArchiveFormat>) => Promise<void>,
): ContextMenuItem[] {
  return Object.entries(streamingArchiveFormatLabelMapping).map(([mime, label]) => ({
    type: 'action',
    icon: faFileArrowDown,
    label: t('common.button.downloadAs', { format: label }),
    onClick: () => onSelect(mime as z.infer<typeof streamingArchiveFormat>),
    color: 'gray',
  }));
}
