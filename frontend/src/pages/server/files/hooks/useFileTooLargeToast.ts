import { faFileArrowDown } from '@fortawesome/free-solid-svg-icons';
import { useCallback } from 'react';
import { z } from 'zod';
import downloadFiles from '@/api/server/files/downloadFiles.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { downloadFilesWithToast } from '@/pages/server/files/list/downloadFilesWithToast.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

export function useFileTooLargeToast() {
  const { t } = useTranslations();
  const { addToast, addPendingToast } = useToast();
  const serverUuid = useServerStore((state) => state.server.uuid);
  const maxViewSize = useGlobalStore((state) => state.settings.server.maxFileManagerViewSize);
  const canReadContent = useServerCan('files.read-content');

  return useCallback(
    (directory: string, file: z.infer<typeof serverDirectoryEntrySchema>) => {
      addToast(
        t('pages.server.files.toast.fileTooLargeToOpen', { limit: bytesToString(maxViewSize) }),
        'warning',
        canReadContent
          ? [
              {
                name: t('common.button.download', {}),
                icon: faFileArrowDown,
                onClick: () =>
                  downloadFilesWithToast(downloadFiles(serverUuid, directory, [file.name], false, 'tar_gz'), {
                    addToast,
                    addPendingToast,
                    t,
                  }),
              },
            ]
          : [],
      );
    },
    [addToast, addPendingToast, t, serverUuid, maxViewSize, canReadContent],
  );
}
