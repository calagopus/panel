import { useRef } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import copyFile from '@/api/server/files/copyFile.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export function useDuplicateFile() {
  const { t } = useTranslations();
  const { addPendingToast } = useToast();
  const server = useServerStore((state) => state.server);
  const duplicating = useRef(false);

  return (path: string) => {
    if (duplicating.current) return;
    duplicating.current = true;

    const pendingToast = addPendingToast(t('pages.server.files.toast.duplicating', {}));

    copyFile(server.uuid, path, null)
      .then(() => pendingToast.settle(t('pages.server.files.toast.fileCopyingStarted', {}), 'success'))
      .catch((msg) => pendingToast.settle(httpErrorToHuman(msg), 'error'))
      .finally(() => {
        duplicating.current = false;
      });
  };
}
