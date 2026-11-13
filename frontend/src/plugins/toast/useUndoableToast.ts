import { faArrowLeftLong } from '@fortawesome/free-solid-svg-icons';
import { ReactNode } from 'react';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { pushUndoEntry, removeUndoEntry, runUndoEntry } from '@/stores/undoHistory.ts';

export function useUndoableToast(scope: string) {
  const { t } = useTranslations();
  const { addToast, updateToast, dismissToast } = useToast();

  return (message: ReactNode, undo: (() => void | Promise<void>) | null): number => {
    if (!undo) return addToast(message, 'success');

    let entryId: number | null = null;
    let dismissed = false;

    const toastId = addToast(
      message,
      'success',
      [
        {
          name: t('common.button.undo', {}),
          icon: faArrowLeftLong,
          onClick: () => (entryId === null ? undefined : runUndoEntry(entryId)),
        },
      ],
      {
        onDismissed: () => {
          dismissed = true;
          if (entryId !== null) removeUndoEntry(entryId);
        },
      },
    );

    if (!dismissed) {
      entryId = pushUndoEntry(scope, () => {
        updateToast(toastId, { progress: null, actions: [] });
        return Promise.resolve(undo()).finally(() => dismissToast(toastId));
      });
    }

    return toastId;
  };
}
