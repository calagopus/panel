import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import restoreTrashEntryItems from '@/api/server/files/trash/restoreTrashEntryItems.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';
import { useTrashItemRestoredToast } from '../useRestoredToast.ts';
import { collectItemConflicts, TrashItemTarget } from './trashItems.ts';

export function useTrashItemRestoreFinished() {
  const queryClient = useQueryClient();
  const server = useServerStore((state) => state.server);
  const store = useFileManagerApi();

  return () => {
    store.getState().doSelectFiles([]);
    store.getState().invalidateFilemanager();
    queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).files.trash() });
  };
}

export function useTrashItemRestore() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const store = useFileManagerApi();
  const entry = useFileManagerStore((state) => state.browsingTrashEntry);
  const onFinished = useTrashItemRestoreFinished();
  const addRestoredToast = useTrashItemRestoredToast(entry?.uuid ?? '', onFinished);

  const [restoring, setRestoring] = useState(false);

  const restore = (targets: TrashItemTarget[]) => {
    if (!entry || targets.length === 0) return;

    setRestoring(true);

    restoreTrashEntryItems({
      uuid: server.uuid,
      entry: entry.uuid,
      files: targets.map((target) => ({ from: target.path })),
    })
      .then(({ restored, conflicts }) => {
        addRestoredToast(restored);
        if (conflicts.length > 0) {
          store.getState().setTrashRestoreConflicts(collectItemConflicts(entry, targets, conflicts));
          store.getState().doOpenModal('trashRestoreConflict');
        } else if (restored.length === 0) {
          addToast(t('pages.server.files.trash.toast.nothingRestored', {}), 'error');
        }

        onFinished();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setRestoring(false));
  };

  return {
    available: entry !== null,
    restoring,
    restore,
  };
}
