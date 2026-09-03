import { load } from 'js-yaml';
import { ChangeEvent, useCallback, useEffect, useRef } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';
import { useImportDragAndDrop } from '@/plugins/import/useImportDragAndDrop.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface UseResourceImportOptions<S extends z.ZodTypeAny> {
  schema: S;
  create: (data: z.infer<S>) => Promise<unknown>;
  onImported?: () => void;
  formatParseError: (error: string) => string;
  importedMessage: string;
  enabled?: boolean;
  transformRaw?: (raw: Record<string, unknown>) => Record<string, unknown>;
}

export function useResourceImport<S extends z.ZodTypeAny>(options: UseResourceImportOptions<S>) {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep the latest options without rebuilding the drag-and-drop listeners every render.
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const importFile = useCallback(
    async (file: File) => {
      const { schema, create, onImported, formatParseError, importedMessage, transformRaw } = optionsRef.current;
      const text = (await file.text()).trim();

      let data: z.infer<S>;
      try {
        const parsed: unknown = text.startsWith('{') ? JSON.parse(text) : load(text);
        const raw = transformRaw ? transformRaw(parsed as Record<string, unknown>) : parsed;
        data = parseFromApi(schema, raw);
      } catch (err) {
        addToast(formatParseError(String(err)), 'error');
        return;
      }

      try {
        await create(data);
        onImported?.();
        addToast(importedMessage, 'success');
      } catch (err) {
        addToast(httpErrorToHuman(err), 'error');
      }
    },
    [addToast],
  );

  const onDrop = useCallback((files: File[]) => Promise.all(files.map(importFile)), [importFile]);

  const { isDragging } = useImportDragAndDrop({ onDrop, enabled: options.enabled });

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      event.target.value = '';
      importFile(file);
    },
    [importFile],
  );

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

  const fileInput = (
    <input type='file' accept='.json,.yml,.yaml' ref={fileInputRef} className='hidden' onChange={handleFileChange} />
  );

  return { isDragging: isDragging && options.enabled !== false, openFilePicker, fileInput };
}
