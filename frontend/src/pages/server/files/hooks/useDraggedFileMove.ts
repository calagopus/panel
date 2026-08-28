import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import { canMoveFilesToDirectory, FileMoveEntry, moveFilesToDirectory } from '@/pages/server/files/browser/fileMove.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useUndoableToast } from '@/plugins/useUndoableToast.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { FileManagerStore, useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';
import { fileManagerUndoScope } from '@/stores/undoHistory.ts';

interface UseDraggedFileMoveOptions {
  disabled?: boolean;
  targetDirectory?: string | null;
}

export function useDraggedFileMove({ disabled = false, targetDirectory }: UseDraggedFileMoveOptions = {}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const addUndoableToast = useUndoableToast(fileManagerUndoScope(server.uuid));
  const canUpdateFiles = useServerCan('files.update');
  const store = useFileManagerApi();
  const [moving, setMoving] = useState(false);

  const canMoveToDirectory = (state: FileManagerStore, target: string) =>
    !disabled &&
    !moving &&
    canUpdateFiles &&
    state.browsingWritableDirectory &&
    canMoveFilesToDirectory(state.draggingFiles.values(), state.draggingFilesSource, target);

  const isDropTargetFor = (state: FileManagerStore, target: string) =>
    canMoveToDirectory(state, target) && state.draggingTarget === target;

  const scopedIsDropTarget = useFileManagerStore((state) =>
    targetDirectory != null ? isDropTargetFor(state, targetDirectory) : false,
  );
  useFileManagerStore(
    useShallow((state) =>
      targetDirectory === undefined
        ? [state.draggingTarget, state.draggingFiles, state.draggingFilesSource, state.browsingWritableDirectory]
        : null,
    ),
  );

  const isDropTarget = (target: string) =>
    targetDirectory !== undefined
      ? target === targetDirectory && scopedIsDropTarget
      : isDropTargetFor(store.getState(), target);

  const undoMove = (movedFiles: FileMoveEntry[], source: string, target: string) =>
    moveFilesToDirectory(server.uuid, movedFiles, target, source)
      .then(({ renamed }) => {
        if (renamed < 1) {
          addToast(t('pages.server.files.toast.moveCouldNotBeUndone', {}), 'error');
          return;
        }

        addToast(t('pages.server.files.toast.moveUndone', { files: tItem('file', renamed) }), 'success');
        store.getState().invalidateFilemanager();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  const moveToDirectory = async (target: string) => {
    const state = store.getState();
    if (!state.draggingFilesSource || !canMoveToDirectory(state, target)) return;

    const source = state.draggingFilesSource;
    const movedFiles = state.draggingFiles.values();

    setMoving(true);

    try {
      const { renamed } = await moveFilesToDirectory(server.uuid, movedFiles, source, target);

      if (renamed > 0) {
        addUndoableToast(t('pages.server.files.toast.filesMoved', { files: tItem('file', renamed) }), () =>
          undoMove(movedFiles, source, target),
        );
        state.doSelectFiles([]);
        state.invalidateFilemanager();
      } else {
        addToast(t('pages.server.files.toast.filesCouldNotBeMoved', {}), 'error');
      }
    } catch (msg) {
      addToast(httpErrorToHuman(msg), 'error');
    }
    setMoving(false);
    store.getState().clearDraggingFiles();
  };

  const getDropHandlers = <T extends HTMLElement = HTMLElement>(target: string) => ({
    onDragOver: (event: React.DragEvent<T>) => {
      const state = store.getState();
      if (!canMoveToDirectory(state, target)) return;

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      state.setDraggingTarget(target);
    },
    onDragLeave: () => {
      const state = store.getState();
      if (isDropTargetFor(state, target)) state.setDraggingTarget(null);
    },
    onDrop: (event: React.DragEvent<T>) => {
      if (!canMoveToDirectory(store.getState(), target)) return;

      event.preventDefault();
      event.stopPropagation();
      void moveToDirectory(target);
    },
  });

  return {
    moving,
    isDropTarget,
    getDropHandlers,
  };
}
