import { useCallback, useEffect, useRef, useState } from 'react';

interface UseFileDragAndDropOptions {
  onDrop: (files: File[]) => Promise<void>;
  enabled?: boolean;
}

const dataTransferHasFiles = (dataTransfer: DataTransfer | null) =>
  !!dataTransfer &&
  (Array.from(dataTransfer.types).includes('Files') ||
    Array.from(dataTransfer.items).some((item) => item.kind === 'file'));

const withRelativePath = (file: File, relativePath: string) => {
  Object.defineProperty(file, 'webkitRelativePath', { configurable: true, value: relativePath });
  return file;
};

async function traverseDirectory(entry: FileSystemDirectoryEntry, files: File[], path: string = ''): Promise<void> {
  return new Promise((resolve) => {
    const reader = entry.createReader();

    const readEntries = () => {
      reader.readEntries(
        async (entries) => {
          if (entries.length === 0) {
            resolve();
            return;
          }

          await Promise.all(
            entries.map((entry) =>
              entry.isFile
                ? new Promise<void>((resolveFile) =>
                    (entry as FileSystemFileEntry).file(
                      (file) => {
                        files.push(withRelativePath(file, `${path}/${file.name}`));
                        resolveFile();
                      },
                      () => resolveFile(),
                    ),
                  )
                : traverseDirectory(entry as FileSystemDirectoryEntry, files, `${path}/${entry.name}`),
            ),
          );

          readEntries();
        },
        () => resolve(),
      );
    };

    readEntries();
  });
}

export async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const entries = Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => ({
      entry: item.webkitGetAsEntry?.() ?? null,
      file: item.getAsFile(),
    }));
  const files: File[] = [];

  for (const { entry, file } of entries) {
    if (entry?.isDirectory) {
      await traverseDirectory(entry as FileSystemDirectoryEntry, files, entry.name);
    } else if (file) {
      files.push(file);
    }
  }

  return files.length > 0 ? files : Array.from(dataTransfer.files);
}

export function useFileDragAndDrop({ onDrop, enabled = true }: UseFileDragAndDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const dragResetTimerRef = useRef<number | null>(null);

  const resetDragState = useCallback(() => {
    if (dragResetTimerRef.current !== null) {
      window.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
    }

    dragCounterRef.current = 0;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      resetDragState();

      if (!enabled) return;

      const files = e.dataTransfer ? await getFilesFromDataTransfer(e.dataTransfer) : [];

      if (files.length > 0) {
        await onDrop(files);
      }
    },
    [enabled, onDrop, resetDragState],
  );

  useEffect(() => {
    if (!enabled) {
      resetDragState();
      return;
    }

    const scheduleDragReset = () => {
      if (dragResetTimerRef.current !== null) window.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = window.setTimeout(resetDragState, 750);
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current++;
      if (dataTransferHasFiles(e.dataTransfer)) {
        setIsDragging(true);
        scheduleDragReset();
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        resetDragState();
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (dataTransferHasFiles(e.dataTransfer)) scheduleDragReset();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) resetDragState();
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('drop', resetDragState, true);
    document.addEventListener('dragend', resetDragState, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', resetDragState);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('drop', resetDragState, true);
      document.removeEventListener('dragend', resetDragState, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', resetDragState);
      if (dragResetTimerRef.current !== null) window.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
      dragCounterRef.current = 0;
    };
  }, [enabled, handleDrop, resetDragState]);

  return { isDragging: enabled && isDragging };
}
