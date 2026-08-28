import { faFileArrowDown } from '@fortawesome/free-solid-svg-icons';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import { ContextMenuItem } from '@/elements/ContextMenu.tsx';
import { streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { AddToast } from '@/providers/contexts/toastContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type TFunc = ReturnType<typeof useTranslations>['t'];

export function downloadFilesWithToast(
  request: Promise<{ url: string }>,
  { addToast, t }: { addToast: AddToast; t: TFunc },
): Promise<void> {
  return request
    .then(({ url }) => {
      addToast(t('pages.server.files.toast.downloadStarted', {}), 'success');
      window.location.href = url;
    })
    .catch((msg) => {
      addToast(httpErrorToHuman(msg), 'error');
    });
}

export function buildDownloadAsMenuItems(
  t: TFunc,
  onSelect: (archiveFormat: z.infer<typeof streamingArchiveFormat>) => void,
): ContextMenuItem[] {
  return Object.entries(streamingArchiveFormatLabelMapping).map(([mime, label]) => ({
    type: 'action',
    icon: faFileArrowDown,
    label: t('common.button.downloadAs', { format: label }),
    onClick: () => onSelect(mime as z.infer<typeof streamingArchiveFormat>),
    color: 'gray',
  }));
}
