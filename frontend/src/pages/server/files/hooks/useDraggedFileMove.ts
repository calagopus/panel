import { useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import { canMoveFilesToDirectory, moveFilesToDirectory } from '@/pages/server/files/fileMove.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export function useDraggedFileMove({ disabled = false } = {}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const canUpdateFiles = useServerCan('files.update');
  const {
    browsingWritableDirectory,
    draggingFiles,
    draggingFilesSource,
    draggingTarget,
    setDraggingTarget,
    clearDraggingFiles,
    doSelectFiles,
    invalidateFilemanager,
  } = useFileManager();
  const [moving, setMoving] = useState(false);

  const draggedFiles = draggingFiles.values();

  const canMoveToDirectory = (targetDirectory: string) =>
    !disabled &&
    !moving &&
    canUpdateFiles &&
    browsingWritableDirectory &&
    canMoveFilesToDirectory(draggedFiles, draggingFilesSource, targetDirectory);

  const isDropTarget = (targetDirectory: string) =>
    canMoveToDirectory(targetDirectory) && draggingTarget === targetDirectory;

  const moveToDirectory = async (targetDirectory: string) => {
    if (!draggingFilesSource || !canMoveToDirectory(targetDirectory)) return;

    setMoving(true);

    try {
      const { renamed } = await moveFilesToDirectory(server.uuid, draggedFiles, draggingFilesSource, targetDirectory);

      if (renamed < 1) {
        addToast(t('pages.server.files.toast.filesCouldNotBeMoved', {}), 'error');
        return;
      }

      addToast(t('pages.server.files.toast.filesMoved', { files: tItem('file', renamed) }), 'success');
      doSelectFiles([]);
      invalidateFilemanager();
    } catch (msg) {
      addToast(httpErrorToHuman(msg), 'error');
    } finally {
      setMoving(false);
      clearDraggingFiles();
    }
  };

  const getDropHandlers = <T extends HTMLElement = HTMLElement>(targetDirectory: string) => ({
    onDragOver: (event: React.DragEvent<T>) => {
      if (!canMoveToDirectory(targetDirectory)) return;

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      setDraggingTarget(targetDirectory);
    },
    onDragLeave: () => {
      if (isDropTarget(targetDirectory)) setDraggingTarget(null);
    },
    onDrop: (event: React.DragEvent<T>) => {
      if (!canMoveToDirectory(targetDirectory)) return;

      event.preventDefault();
      event.stopPropagation();
      void moveToDirectory(targetDirectory);
    },
  });

  return {
    moving,
    isDropTarget,
    getDropHandlers,
  };
}
