import { AxiosError, AxiosRequestConfig } from 'axios';
import { ChangeEvent, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error';

interface FileUploadProgress {
  filePath: string;
  progress: number;
  size: number;
  uploaded: number;
  batchId: string;
  status: UploadStatus;
  retryAttempt: number;
}

export interface AggregatedUploadProgress {
  totalSize: number;
  uploadedSize: number;
  fileCount: number;
}

export interface FileUploader {
  uploadingFiles: Map<string, FileUploadProgress>;
  aggregatedUploadProgress: Map<string, AggregatedUploadProgress>;
  totalUploadProgress: number;
  uploadFiles: (files: File[]) => Promise<void>;
  cancelFileUpload: (fileKey: string) => void;
  cancelFolderUpload: (folderName: string) => void;
  cancelAllUploads: () => void;
  handleFileSelect: (event: ChangeEvent<HTMLInputElement>, inputRef: RefObject<HTMLInputElement | null>) => void;
  handleFolderSelect: (event: ChangeEvent<HTMLInputElement>, inputRef: RefObject<HTMLInputElement | null>) => void;
}

export interface UploadResult {
  url: string;
  continuationToken?: string | null;
}

export type UploadFunction = (form: FormData, config: AxiosRequestConfig) => Promise<UploadResult>;

export type SplitUploadFunction = (
  form: FormData,
  config: AxiosRequestConfig,
  continuationToken: string,
  prevUrl: string,
) => Promise<UploadResult>;

const CHUNK_TARGET_BYTES = 95 * 1024 * 1024; // 95 MiB
const FOLDER_CONCURRENCY = 2;
const FILE_CONCURRENCY = 10;
const MAX_RETRIES = 5;
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

function is429Error(error: AxiosError): boolean {
  return error.response?.status === 429;
}

function get429RetryDelay(error: AxiosError, attempt: number): number {
  const retryAfter = error.response?.headers['retry-after'];
  if (retryAfter) {
    const seconds = parseFloat(String(retryAfter));
    if (!isNaN(seconds)) return seconds * 1000;
    const date = new Date(String(retryAfter));
    if (!isNaN(date.getTime())) return Math.max(BASE_RETRY_MS, date.getTime() - Date.now());
  }
  return Math.min(BASE_RETRY_MS * 2 ** attempt, MAX_RETRY_MS);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        resolve();
      },
      { once: true },
    );
  });
}

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

function chunkFiles(files: File[]): File[][] {
  const sorted = [...files].sort((a, b) => b.size - a.size);
  const chunks: File[][] = [];
  const chunkSizes: number[] = [];

  for (const file of sorted) {
    let placed = false;
    for (let i = 0; i < chunks.length; i++) {
      const wouldBe = chunkSizes[i] + file.size;
      if (wouldBe <= CHUNK_TARGET_BYTES) {
        chunks[i].push(file);
        chunkSizes[i] = wouldBe;
        placed = true;
        break;
      }
    }
    if (!placed) {
      chunks.push([file]);
      chunkSizes.push(file.size);
    }
  }

  return chunks;
}

export function useFileUpload(
  uploadFunction: UploadFunction,
  onUploadComplete: () => void,
  splitUploadFunction?: SplitUploadFunction,
): FileUploader {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const [uploadingFiles, setUploadingFiles] = useState<Map<string, FileUploadProgress>>(new Map());
  const fileIndexCounter = useRef(0);
  const activeUploads = useRef(0);
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const folderFileCounts = useRef<Map<string, number>>(new Map());

  const onUploadCompleteRef = useRef(onUploadComplete);
  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete;
  }, [onUploadComplete]);

  useEffect(() => {
    if (uploadingFiles.size === 0) return;

    const batchFiles = new Map<string, { allDone: boolean; keys: string[] }>();
    uploadingFiles.forEach((file, key) => {
      const entry = batchFiles.get(file.batchId) ?? { allDone: true, keys: [] };
      entry.keys.push(key);

      const isDone =
        file.status === 'completed' ||
        file.status === 'error' ||
        (file.size > 0 && file.uploaded >= file.size && file.progress >= 100);
      if (!isDone) {
        entry.allDone = false;
      }
      batchFiles.set(file.batchId, entry);
    });

    const keysToRemove: string[] = [];
    batchFiles.forEach((batch) => {
      if (batch.allDone) keysToRemove.push(...batch.keys);
    });

    if (keysToRemove.length > 0) {
      const foldersBeingRemoved = new Set<string>();
      keysToRemove.forEach((key) => {
        const file = uploadingFiles.get(key);
        if (file && file.filePath.includes('/')) {
          foldersBeingRemoved.add(file.filePath.split('/')[0]);
        }
      });

      const nextUploadingFiles = new Map(uploadingFiles);
      keysToRemove.forEach((key) => nextUploadingFiles.delete(key));

      foldersBeingRemoved.forEach((folder) => {
        let hasRemainingFiles = false;
        for (const file of nextUploadingFiles.values()) {
          if (file.filePath.split('/')[0] === folder) {
            hasRemainingFiles = true;
            break;
          }
        }

        if (!hasRemainingFiles) {
          folderFileCounts.current.delete(folder);
        }
      });

      setUploadingFiles(nextUploadingFiles);
      onUploadCompleteRef.current();
    }
  }, [uploadingFiles]);

  const uploadRequest = useCallback(
    async (files: File[], indices: number[], batchId: string, controller: AbortController) => {
      activeUploads.current++;

      try {
        setUploadingFiles((prev) => {
          const next = new Map(prev);
          for (const idx of indices) {
            const key = `file-${idx}`;
            const entry = next.get(key);

            if (entry && entry.status !== 'completed' && entry.status !== 'error') {
              next.set(key, { ...entry, status: 'uploading' });
            }
          }
          return next;
        });

        const formData = new FormData();
        for (const file of files) {
          formData.append('files', file, file.webkitRelativePath || file.name);
        }

        const totalRequestSize = files.reduce((sum, f) => sum + f.size, 0);
        let lastLoaded = 0;

        const config: AxiosRequestConfig = {
          signal: controller.signal,
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => {
            const loaded = event.loaded ?? 0;
            const delta = loaded - lastLoaded;
            lastLoaded = loaded;
            if (delta <= 0) return;

            setUploadingFiles((prev) => {
              const next = new Map(prev);
              for (let i = 0; i < indices.length; i++) {
                const key = `file-${indices[i]}`;
                const entry = next.get(key);

                if (!entry || entry.status === 'completed' || entry.status === 'error') continue;

                const ratio = files[i].size / totalRequestSize;
                const newUploaded = Math.min(entry.uploaded + delta * ratio, files[i].size);
                next.set(key, {
                  ...entry,
                  uploaded: newUploaded,
                  progress: (newUploaded / files[i].size) * 100,
                });
              }
              return next;
            });
          },
        };

        for (let attempt = 0; ; attempt++) {
          try {
            lastLoaded = 0;
            await uploadFunction(formData, config);
            break;
          } catch (err) {
            if (
              !(err instanceof AxiosError) ||
              !is429Error(err) ||
              attempt >= MAX_RETRIES ||
              controller.signal.aborted
            ) {
              throw err;
            }
            setUploadingFiles((prev) => {
              const next = new Map(prev);
              for (const idx of indices) {
                const key = `file-${idx}`;
                const entry = next.get(key);
                if (entry) next.set(key, { ...entry, retryAttempt: attempt + 1 });
              }
              return next;
            });
            await sleep(get429RetryDelay(err, attempt), controller.signal);
          }
        }

        setUploadingFiles((prev) => {
          const next = new Map(prev);
          for (const idx of indices) {
            const key = `file-${idx}`;
            const entry = next.get(key);
            if (entry && entry.status !== 'error') {
              next.set(key, { ...entry, progress: 100, uploaded: entry.size, status: 'completed' });
            }
          }
          return next;
        });
      } catch (error) {
        const isCancelled =
          error instanceof AxiosError
            ? error.code === 'ERR_CANCELED' || error.code === 'CanceledError'
            : error instanceof Error && (error as Error & { code?: string }).code === 'ERR_CANCELED';

        if (!isCancelled) {
          console.error('Upload error:', error);
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            for (const idx of indices) {
              const key = `file-${idx}`;
              const entry = next.get(key);
              if (entry && entry.status !== 'completed') {
                next.set(key, { ...entry, status: 'error' });
              }
            }
            return next;
          });
          const message = error instanceof Error ? error.message : 'Unknown error';
          addToast(`Upload failed: ${message}`, 'error');
        }
      } finally {
        activeUploads.current--;
      }
    },
    [uploadFunction, addToast],
  );

  const uploadSplitFile = useCallback(
    async (file: File, fileIndex: number, batchId: string, controller: AbortController) => {
      if (!splitUploadFunction) {
        throw new Error('uploadSplitFile called without a splitUploadFunction');
      }

      activeUploads.current++;

      const key = `file-${fileIndex}`;
      const filename = file.webkitRelativePath || file.name;
      const totalSize = file.size;

      try {
        setUploadingFiles((prev) => {
          const entry = prev.get(key);

          if (!entry || entry.status === 'completed' || entry.status === 'error') return prev;
          const next = new Map(prev);
          next.set(key, { ...entry, status: 'uploading' });
          return next;
        });

        let offset = 0;
        let priorUploaded = 0;
        let continuationToken: string | undefined;
        let prevUrl: string | undefined;

        while (offset < totalSize) {
          if (controller.signal.aborted) {
            const err: Error & { code?: string } = new Error('canceled');
            err.code = 'ERR_CANCELED';
            throw err;
          }

          const sliceEnd = Math.min(offset + CHUNK_TARGET_BYTES, totalSize);
          const isLastSlice = sliceEnd >= totalSize;
          const sliceBlob = file.slice(offset, sliceEnd);
          const sliceFile = new File([sliceBlob], filename, { type: file.type });

          const formData = new FormData();
          formData.append('files', sliceFile, filename);

          const sliceSize = sliceEnd - offset;
          let lastLoaded = 0;

          const params: Record<string, string> = {};
          if (!isLastSlice) {
            params.wants_continue = '0';
          }

          const config: AxiosRequestConfig = {
            signal: controller.signal,
            headers: { 'Content-Type': 'multipart/form-data' },
            params,
            onUploadProgress: (event) => {
              const loaded = event.loaded ?? 0;
              const delta = loaded - lastLoaded;
              lastLoaded = loaded;
              if (delta <= 0) return;

              setUploadingFiles((prev) => {
                const entry = prev.get(key);

                if (!entry || entry.status === 'completed' || entry.status === 'error') return prev;

                const next = new Map(prev);
                const newUploaded = Math.min(priorUploaded + loaded, totalSize);
                next.set(key, {
                  ...entry,
                  uploaded: newUploaded,
                  progress: (newUploaded / totalSize) * 100,
                });
                return next;
              });
            },
          };

          let result!: UploadResult;
          for (let attempt = 0; ; attempt++) {
            try {
              lastLoaded = 0;
              result =
                continuationToken === undefined || prevUrl === undefined
                  ? await uploadFunction(formData, config)
                  : await splitUploadFunction!(formData, config, continuationToken, prevUrl);
              break;
            } catch (err) {
              if (
                !(err instanceof AxiosError) ||
                !is429Error(err) ||
                attempt >= MAX_RETRIES ||
                controller.signal.aborted
              ) {
                throw err;
              }
              setUploadingFiles((prev) => {
                const entry = prev.get(key);
                if (!entry) return prev;
                const next = new Map(prev);
                next.set(key, { ...entry, retryAttempt: attempt + 1 });
                return next;
              });
              await sleep(get429RetryDelay(err, attempt), controller.signal);
            }
          }

          priorUploaded += sliceSize;
          offset = sliceEnd;

          prevUrl = result.url;

          if (!isLastSlice) {
            if (!result.continuationToken) {
              throw new Error('server did not return a continuation token for a non-final slice');
            }
            continuationToken = result.continuationToken;
          }
        }

        setUploadingFiles((prev) => {
          const entry = prev.get(key);
          if (!entry || entry.status === 'error') return prev;
          const next = new Map(prev);
          next.set(key, { ...entry, progress: 100, uploaded: entry.size, status: 'completed' });
          return next;
        });
      } catch (error) {
        const isCancelled =
          error instanceof AxiosError
            ? error.code === 'ERR_CANCELED' || error.code === 'CanceledError'
            : error instanceof Error && (error as Error & { code?: string }).code === 'ERR_CANCELED';

        if (!isCancelled) {
          console.error('Upload error:', error);
          setUploadingFiles((prev) => {
            const entry = prev.get(key);
            if (!entry || entry.status === 'completed') return prev;
            const next = new Map(prev);
            next.set(key, { ...entry, status: 'error' });
            return next;
          });
          const message = error instanceof Error ? error.message : 'Unknown error';
          addToast(`Upload failed: ${message}`, 'error');
        }
      } finally {
        activeUploads.current--;
      }

      void batchId;
    },
    [uploadFunction, splitUploadFunction, addToast],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const splittingEnabled = splitUploadFunction !== undefined;

      const startIndex = fileIndexCounter.current;
      fileIndexCounter.current += files.length;

      const individualFiles: Array<{ file: File; index: number }> = [];
      const folderFiles: Array<{ file: File; index: number }> = [];

      files.forEach((file, i) => {
        const idx = startIndex + i;
        const path = file.webkitRelativePath || file.name;
        const isFolder = path.includes('/');
        (isFolder ? folderFiles : individualFiles).push({ file, index: idx });
      });

      const folderBatchIds = new Map<string, string>();
      const folderCounts = new Map<string, number>();
      for (const { file } of folderFiles) {
        const path = file.webkitRelativePath || file.name;
        const folder = path.split('/')[0];
        if (!folderBatchIds.has(folder)) {
          folderBatchIds.set(folder, `folder-${folder}-${Date.now()}`);
        }
        folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
      }

      folderCounts.forEach((count, folder) => {
        const existingCount = folderFileCounts.current.get(folder) ?? 0;
        folderFileCounts.current.set(folder, existingCount + count);
      });

      const individualBatchId = `individual-batch-${Date.now()}`;

      setUploadingFiles((prev) => {
        const next = new Map(prev);

        for (const { file, index } of individualFiles) {
          const key = `file-${index}`;
          next.set(key, {
            filePath: file.name,
            progress: 0,
            size: file.size,
            uploaded: 0,
            batchId: individualBatchId,
            status: 'pending',
            retryAttempt: 0,
          });
        }

        for (const { file, index } of folderFiles) {
          const path = file.webkitRelativePath || file.name;
          const folder = path.split('/')[0];
          const batchId = folderBatchIds.get(folder)!;
          next.set(`file-${index}`, {
            filePath: path,
            progress: 0,
            size: file.size,
            uploaded: 0,
            batchId,
            status: 'pending',
            retryAttempt: 0,
          });
        }

        return next;
      });

      for (const { index } of individualFiles) {
        const key = `file-${index}`;
        controllers.current.set(key, new AbortController());
      }

      for (const [, batchId] of folderBatchIds) {
        controllers.current.set(batchId, new AbortController());
      }

      const promises: Promise<void>[] = [];

      const fileSemaphore = new Semaphore(FILE_CONCURRENCY);
      for (const { file, index } of individualFiles) {
        const key = `file-${index}`;
        const controller = controllers.current.get(key)!;

        promises.push(
          fileSemaphore.acquire().then(async () => {
            try {
              if (controller.signal.aborted) return;
              if (splittingEnabled && file.size > CHUNK_TARGET_BYTES) {
                await uploadSplitFile(file, index, key, controller);
              } else {
                await uploadRequest([file], [index], key, controller);
              }
            } finally {
              fileSemaphore.release();
            }
          }),
        );
      }

      const folderGroups = new Map<string, Array<{ file: File; index: number }>>();
      for (const entry of folderFiles) {
        const path = entry.file.webkitRelativePath || entry.file.name;
        const folder = path.split('/')[0];
        if (!folderGroups.has(folder)) folderGroups.set(folder, []);
        folderGroups.get(folder)!.push(entry);
      }

      for (const [folder, entries] of folderGroups) {
        const batchId = folderBatchIds.get(folder)!;
        const controller = controllers.current.get(batchId)!;

        let entriesToPack = entries;
        if (splittingEnabled) {
          const oversized = entries.filter((e) => e.file.size > CHUNK_TARGET_BYTES);
          entriesToPack = entries.filter((e) => e.file.size <= CHUNK_TARGET_BYTES);

          for (const entry of oversized) {
            promises.push(uploadSplitFile(entry.file, entry.index, batchId, controller));
          }
        }

        if (entriesToPack.length === 0) continue;

        const chunks = chunkFiles(entriesToPack.map((e) => e.file));

        const fileToIndex = new Map<File, number>();
        for (const entry of entriesToPack) {
          fileToIndex.set(entry.file, entry.index);
        }

        const semaphore = new Semaphore(FOLDER_CONCURRENCY);
        for (const chunk of chunks) {
          const chunkIndices = chunk.map((f) => fileToIndex.get(f)!);
          promises.push(
            semaphore.acquire().then(async () => {
              try {
                if (controller.signal.aborted) return;
                await uploadRequest(chunk, chunkIndices, batchId, controller);
              } finally {
                semaphore.release();
              }
            }),
          );
        }
      }

      addToast(
        t('elements.fileUpload.toast.uploading', {
          files: tItem('file', files.length),
        }),
        'success',
      );

      await Promise.allSettled(promises);
    },
    [uploadRequest, uploadSplitFile, addToast, splitUploadFunction],
  );

  const cancelFileUpload = useCallback((fileKey: string) => {
    setUploadingFiles((prev) => {
      const entry = prev.get(fileKey);
      if (!entry) return prev;

      const controller = controllers.current.get(entry.batchId);
      controller?.abort();
      controllers.current.delete(entry.batchId);

      const next = new Map(prev);
      next.delete(fileKey);

      addToast(
        t('elements.fileUpload.toast.cancelledFile', {
          file: entry.filePath,
        }).md(),
        'success',
      );
      return next;
    });
  }, []);

  const cancelFolderUpload = useCallback(
    (folderName: string) => {
      folderFileCounts.current.delete(folderName);

      setUploadingFiles((prev) => {
        const keysToRemove: string[] = [];
        let batchId: string | null = null;

        prev.forEach((file, key) => {
          if (file.filePath.split('/')[0] === folderName) {
            keysToRemove.push(key);
            batchId = file.batchId;
          }
        });

        if (keysToRemove.length === 0) return prev;

        if (batchId) {
          controllers.current.get(batchId)?.abort();
          controllers.current.delete(batchId);
        }

        const next = new Map(prev);
        keysToRemove.forEach((key) => next.delete(key));

        addToast(
          t('elements.fileUpload.toast.cancelledFolder', {
            folder: folderName,
            files: tItem('file', keysToRemove.length),
          }).md(),
          'success',
        );
        return next;
      });
    },
    [addToast],
  );

  const cancelAllUploads = useCallback(() => {
    controllers.current.forEach((controller) => controller.abort());
    controllers.current.clear();
    folderFileCounts.current.clear();
    setUploadingFiles(new Map());
    onUploadCompleteRef.current();
    addToast(t('elements.fileUpload.toast.cancelledAll', {}), 'success');
  }, []);

  const aggregatedUploadProgress = useMemo(() => {
    const map = new Map<string, AggregatedUploadProgress>();

    uploadingFiles.forEach((file) => {
      const parts = file.filePath.split('/');
      if (parts.length < 2) return;

      const folder = parts[0];
      const prev = map.get(folder) ?? {
        totalSize: 0,
        uploadedSize: 0,
        fileCount: folderFileCounts.current.get(folder) ?? 0,
      };

      map.set(folder, {
        ...prev,
        totalSize: prev.totalSize + file.size,
        uploadedSize: prev.uploadedSize + file.uploaded,
        fileCount: prev.fileCount,
      });
    });

    return map;
  }, [uploadingFiles]);

  const totalUploadProgress = useMemo(() => {
    if (uploadingFiles.size === 0) return 0;

    let totalSize = 0;
    let totalUploaded = 0;

    uploadingFiles.forEach((file) => {
      totalSize += file.size;
      totalUploaded += file.uploaded;
    });

    return totalSize === 0 ? 0 : (totalUploaded / totalSize) * 100;
  }, [uploadingFiles]);

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>, inputRef: RefObject<HTMLInputElement | null>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length > 0) uploadFiles(files);
      if (inputRef.current) inputRef.current.value = '';
    },
    [uploadFiles],
  );

  const handleFolderSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>, inputRef: RefObject<HTMLInputElement | null>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length > 0) uploadFiles(files);
      if (inputRef.current) inputRef.current.value = '';
    },
    [uploadFiles],
  );

  return {
    uploadingFiles,
    aggregatedUploadProgress,
    totalUploadProgress,
    uploadFiles,
    cancelFileUpload,
    cancelFolderUpload,
    cancelAllUploads,
    handleFileSelect,
    handleFolderSelect,
  };
}
