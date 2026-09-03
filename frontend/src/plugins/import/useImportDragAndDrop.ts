import { useCallback, useEffect, useRef, useState } from 'react';

interface UseFileDragAndDropOptions {
  onDrop: (files: File[]) => Promise<unknown>;
  enabled?: boolean;
  filterFile?: (file: File) => boolean;
}

const ACCEPTED_EXTENSIONS = ['.json', '.yaml', '.yml'];

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

export function useImportDragAndDrop({
  onDrop,
  enabled = true,
  filterFile = isAcceptedFile,
}: UseFileDragAndDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      dragCounterRef.current = 0;

      if (!enabled) return;

      const files = Array.from(e.dataTransfer?.files || []);
      const acceptedFiles = files.filter(filterFile);

      if (acceptedFiles.length > 0) {
        await onDrop(acceptedFiles);
      }
    },
    [enabled, onDrop, filterFile],
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
