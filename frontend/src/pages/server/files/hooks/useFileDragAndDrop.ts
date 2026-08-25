import { useCallback, useEffect, useRef, useState } from 'react';

interface UseFileDragAndDropOptions {
  onDrop: (files: File[]) => Promise<void>;
  enabled?: boolean;
}

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

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      dragCounterRef.current = 0;

      if (!enabled) return;

      const files = e.dataTransfer ? await getFilesFromDataTransfer(e.dataTransfer) : [];

      if (files.length > 0) {
        await onDrop(files);
      }
    },
    [enabled, onDrop],
  );

  useEffect(() => {
    if (!enabled) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0 && e.dataTransfer.items[0].kind === 'file') {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [enabled, handleDrop]);

  return { isDragging };
}
