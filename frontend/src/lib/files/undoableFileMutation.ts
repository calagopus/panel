import { ReactNode } from 'react';
import { AddToast } from '@/providers/contexts/toastContext.ts';

export function createUndoAction<R>(
  reverseCall: () => Promise<R>,
  getCount: (result: R) => number,
  {
    addToast,
    invalidateFilemanager,
    cannotUndoMessage,
    undoneMessage,
    onError,
  }: {
    addToast: AddToast;
    invalidateFilemanager: () => void;
    cannotUndoMessage: ReactNode;
    undoneMessage: ReactNode;
    onError: (err: unknown) => void;
  },
): () => Promise<void> {
  return () =>
    reverseCall()
      .then((result) => {
        if (getCount(result) < 1) {
          addToast(cannotUndoMessage, 'error');
          return;
        }

        addToast(undoneMessage, 'success');
        invalidateFilemanager();
      })
      .catch(onError);
}
