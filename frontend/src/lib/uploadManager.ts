import { QueryClient } from '@tanstack/react-query';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { ReactNode } from 'react';
import uploadAssets from '@/api/admin/assets/uploadAssets.ts';
import { axiosInstance } from '@/api/axios.ts';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl.ts';
import { ToastAction, ToastType } from '@/providers/contexts/toastContext.ts';
import { getTranslations } from '@/providers/contexts/translationContext.ts';
import { UploadDestination, UploadItem, uploadScopeKey, useUploadsStore } from '@/stores/uploads.ts';

export interface UploadResult {
  url: string;
  continuationToken?: string | null;
}

interface UploadManagerExternals {
  queryClient: QueryClient;
  addToast: (message: ReactNode, type?: ToastType, actions?: ToastAction[]) => void;
  onUploadsComplete: (destination: UploadDestination, fileCount: number) => void;
}

let externals: UploadManagerExternals | null = null;

export function setUploadManagerExternals(ext: UploadManagerExternals): void {
  externals = ext;
}

interface DestinationHandler<D extends UploadDestination = UploadDestination> {
  upload: (destination: D, form: FormData, config: AxiosRequestConfig) => Promise<UploadResult | undefined>;
  splitUpload?: (
    destination: D,
    form: FormData,
    config: AxiosRequestConfig,
    continuationToken: string,
    prevUrl: string,
  ) => Promise<UploadResult>;
  onBatchComplete: (destination: D) => void;
}

const fileManagerRefreshers = new Map<string, Set<() => void>>();

export function registerUploadRefresh(scope: string, fn: () => void): () => void {
  let set = fileManagerRefreshers.get(scope);
  if (!set) {
    set = new Set();
    fileManagerRefreshers.set(scope, set);
  }
  set.add(fn);

  return () => {
    const current = fileManagerRefreshers.get(scope);
    current?.delete(fn);
    if (current?.size === 0) fileManagerRefreshers.delete(scope);
  };
}

const handlers: {
  [K in UploadDestination['type']]: DestinationHandler<Extract<UploadDestination, { type: K }>>;
} = {
  server: {
    upload: async (destination, form, config) => {
      const { url } = await getFileUploadUrl(destination.serverUuid, destination.directory);
      const { data } = await axiosInstance.post(url, form, config);

      return { url, continuationToken: data.continuation_token ?? null };
    },
    splitUpload: async (_destination, form, config, continuationToken, prevUrl) => {
      const { data } = await axiosInstance.post(prevUrl, form, {
        ...config,
        params: { ...config.params, continuation_token: continuationToken },
      });

      return { url: prevUrl, continuationToken: data.continuation_token ?? null };
    },
    onBatchComplete: (destination) => {
      const refreshers = fileManagerRefreshers.get(uploadScopeKey(destination));
      if (refreshers?.size) {
        refreshers.forEach((fn) => fn());
        return;
      }

      externals?.queryClient
        .invalidateQueries({ queryKey: ['server', destination.serverUuid, 'files'] })
        .catch((e) => console.error(e));
    },
  },
  adminAsset: {
    upload: async (destination, form, config) => {
      await uploadAssets(form, config, destination.directory);
      return undefined;
    },
    onBatchComplete: () => {
      externals?.queryClient.invalidateQueries({ queryKey: ['admin', 'assets'] }).catch((e) => console.error(e));
    },
  },
};

function handlerFor(destination: UploadDestination): DestinationHandler {
  return handlers[destination.type] as DestinationHandler;
}

const CHUNK_TARGET_BYTES = 95 * 1024 * 1024; // 95 MiB
const FOLDER_CONCURRENCY = 2;
const FILE_CONCURRENCY = 10;
const MAX_RETRIES = 5;
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
const PROGRESS_FLUSH_MS = 100;

const controllers = new Map<string, AbortController>();
const folderFileCounts = new Map<string, number>();
const pendingProgress = new Map<string, number>();
const failureToastedBatches = new Set<string>();
let progressFlushTimer: ReturnType<typeof setTimeout> | null = null;
let fileIndexCounter = 0;

function folderCountKey(scope: string, folder: string): string {
  return `${scope}\n${folder}`;
}

export function getFolderFileCount(scope: string, folder: string): number {
  return folderFileCounts.get(folderCountKey(scope, folder)) ?? 0;
}

function setUploads(updater: (prev: Map<string, UploadItem>) => Map<string, UploadItem>): void {
  const prev = useUploadsStore.getState().uploads;
  const next = updater(prev);
  if (next !== prev) useUploadsStore.setState({ uploads: next });
}

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

function queueProgress(key: string, uploaded: number): void {
  pendingProgress.set(key, uploaded);
  if (progressFlushTimer !== null) return;

  progressFlushTimer = setTimeout(() => {
    progressFlushTimer = null;
    const updates = new Map(pendingProgress);
    pendingProgress.clear();

    setUploads((prev) => {
      let changed = false;
      const next = new Map(prev);
      updates.forEach((uploaded, key) => {
        const entry = next.get(key);
        if (!entry || entry.status === 'completed' || entry.status === 'error') return;

        const clamped = Math.min(uploaded, entry.size);
        if (clamped === entry.uploaded) return;
        next.set(key, {
          ...entry,
          uploaded: clamped,
          progress: entry.size === 0 ? 100 : (clamped / entry.size) * 100,
        });
        changed = true;
      });
      return changed ? next : prev;
    });

    settleBatches();
  }, PROGRESS_FLUSH_MS);
}

function settleBatches(): void {
  const uploads = useUploadsStore.getState().uploads;
  if (uploads.size === 0) return;

  interface BatchInfo {
    allDone: boolean;
    hadError: boolean;
    keys: string[];
    destination: UploadDestination;
  }

  const batches = new Map<string, BatchInfo>();
  uploads.forEach((file, key) => {
    const entry = batches.get(file.batchId) ?? {
      allDone: true,
      hadError: false,
      keys: [],
      destination: file.destination,
    };
    entry.keys.push(key);

    const isDone =
      file.status === 'completed' ||
      file.status === 'error' ||
      (file.size > 0 && file.uploaded >= file.size && file.progress >= 100);
    if (!isDone) {
      entry.allDone = false;
    }
    if (file.status === 'error') {
      entry.hadError = true;
    }
    batches.set(file.batchId, entry);
  });

  const keysToRemove: string[] = [];
  const completedBatches: BatchInfo[] = [];
  batches.forEach((batch, batchId) => {
    if (!batch.allDone) return;

    keysToRemove.push(...batch.keys);
    controllers.delete(batchId);
    batch.keys.forEach((key) => controllers.delete(key));
    failureToastedBatches.delete(batchId);
    completedBatches.push(batch);
  });

  if (keysToRemove.length === 0) return;

  const foldersBeingRemoved = new Set<string>();
  keysToRemove.forEach((key) => {
    const file = uploads.get(key);
    if (file && file.filePath.includes('/')) {
      foldersBeingRemoved.add(folderCountKey(uploadScopeKey(file.destination), file.filePath.split('/')[0]));
    }
  });

  const remainingFiles = new Map(uploads);
  keysToRemove.forEach((key) => remainingFiles.delete(key));

  foldersBeingRemoved.forEach((countKey) => {
    let hasRemainingFiles = false;
    for (const file of remainingFiles.values()) {
      if (folderCountKey(uploadScopeKey(file.destination), file.filePath.split('/')[0]) === countKey) {
        hasRemainingFiles = true;
        break;
      }
    }

    if (!hasRemainingFiles) {
      folderFileCounts.delete(countKey);
    }
  });

  setUploads((prev) => {
    const next = new Map(prev);
    keysToRemove.forEach((key) => next.delete(key));
    return next;
  });

  const scopes = new Map<string, { destination: UploadDestination; fileCount: number; hadError: boolean }>();
  completedBatches.forEach((batch) => {
    const scope = uploadScopeKey(batch.destination);
    const entry = scopes.get(scope) ?? { destination: batch.destination, fileCount: 0, hadError: false };
    if (!batch.hadError) entry.fileCount += batch.keys.length;
    entry.hadError ||= batch.hadError;
    scopes.set(scope, entry);
  });

  scopes.forEach(({ destination, fileCount }) => {
    handlerFor(destination).onBatchComplete(destination);
    if (fileCount > 0) externals?.onUploadsComplete(destination, fileCount);
  });
}

function isCancelledError(error: unknown): boolean {
  return error instanceof AxiosError
    ? error.code === 'ERR_CANCELED' || error.code === 'CanceledError'
    : error instanceof Error && (error as Error & { code?: string }).code === 'ERR_CANCELED';
}

function handleUploadError(error: unknown, batchId: string, markError: () => void): void {
  if (isCancelledError(error)) return;

  console.error('Upload error:', error);
  markError();

  if (!failureToastedBatches.has(batchId)) {
    failureToastedBatches.add(batchId);
    const message = error instanceof Error ? error.message : 'Unknown error';
    externals?.addToast(`Upload failed: ${message}`, 'error');
  }
}

async function uploadRequest(
  destination: UploadDestination,
  files: File[],
  indices: number[],
  batchId: string,
  controller: AbortController,
): Promise<void> {
  try {
    setUploads((prev) => {
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

    const config: AxiosRequestConfig = {
      signal: controller.signal,
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        const loaded = event.loaded ?? 0;

        for (let i = 0; i < indices.length; i++) {
          const ratio = totalRequestSize === 0 ? 1 : files[i].size / totalRequestSize;
          queueProgress(`file-${indices[i]}`, Math.min(loaded * ratio, files[i].size));
        }
      },
    };

    const handler = handlerFor(destination);
    for (let attempt = 0; ; attempt++) {
      try {
        await handler.upload(destination, formData, config);
        break;
      } catch (err) {
        if (!(err instanceof AxiosError) || !is429Error(err) || attempt >= MAX_RETRIES || controller.signal.aborted) {
          throw err;
        }
        setUploads((prev) => {
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

    setUploads((prev) => {
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
    handleUploadError(error, batchId, () =>
      setUploads((prev) => {
        const next = new Map(prev);
        for (const idx of indices) {
          const key = `file-${idx}`;
          const entry = next.get(key);
          if (entry && entry.status !== 'completed') {
            next.set(key, { ...entry, status: 'error' });
          }
        }
        return next;
      }),
    );
  } finally {
    settleBatches();
  }
}

async function uploadSplitFile(
  destination: UploadDestination,
  file: File,
  fileIndex: number,
  batchId: string,
  controller: AbortController,
): Promise<void> {
  const handler = handlerFor(destination);
  if (!handler.splitUpload) {
    throw new Error('uploadSplitFile called for a destination without split upload support');
  }

  const key = `file-${fileIndex}`;
  const filename = file.webkitRelativePath || file.name;
  const totalSize = file.size;

  try {
    setUploads((prev) => {
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
          queueProgress(key, Math.min(priorUploaded + loaded, totalSize));
        },
      };

      let result!: UploadResult;
      for (let attempt = 0; ; attempt++) {
        try {
          const res =
            continuationToken === undefined || prevUrl === undefined
              ? await handler.upload(destination, formData, config)
              : await handler.splitUpload(destination, formData, config, continuationToken, prevUrl);
          if (!res) {
            throw new Error('upload handler did not return a result for a split upload');
          }
          result = res;
          break;
        } catch (err) {
          if (!(err instanceof AxiosError) || !is429Error(err) || attempt >= MAX_RETRIES || controller.signal.aborted) {
            throw err;
          }
          setUploads((prev) => {
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

    setUploads((prev) => {
      const entry = prev.get(key);
      if (!entry || entry.status === 'error') return prev;
      const next = new Map(prev);
      next.set(key, { ...entry, progress: 100, uploaded: entry.size, status: 'completed' });
      return next;
    });
  } catch (error) {
    handleUploadError(error, batchId, () =>
      setUploads((prev) => {
        const entry = prev.get(key);
        if (!entry || entry.status === 'completed') return prev;
        const next = new Map(prev);
        next.set(key, { ...entry, status: 'error' });
        return next;
      }),
    );
  } finally {
    settleBatches();
  }
}

export async function uploadFiles(destination: UploadDestination, files: File[]): Promise<void> {
  if (files.length === 0) return;

  const scope = uploadScopeKey(destination);
  const splittingEnabled = handlerFor(destination).splitUpload !== undefined;

  const startIndex = fileIndexCounter;
  fileIndexCounter += files.length;

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
      folderBatchIds.set(folder, `${scope}/folder-${folder}-${Date.now()}`);
    }
    folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
  }

  folderCounts.forEach((count, folder) => {
    const countKey = folderCountKey(scope, folder);
    const existingCount = folderFileCounts.get(countKey) ?? 0;
    folderFileCounts.set(countKey, existingCount + count);
  });

  const individualBatchId = `${scope}/individual-batch-${Date.now()}`;

  setUploads((prev) => {
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
        destination,
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
        destination,
      });
    }

    return next;
  });

  for (const { index } of individualFiles) {
    const key = `file-${index}`;
    controllers.set(key, new AbortController());
  }

  for (const [, batchId] of folderBatchIds) {
    controllers.set(batchId, new AbortController());
  }

  const promises: Promise<void>[] = [];

  const fileSemaphore = new Semaphore(FILE_CONCURRENCY);
  for (const { file, index } of individualFiles) {
    const key = `file-${index}`;
    const controller = controllers.get(key)!;

    promises.push(
      fileSemaphore.acquire().then(async () => {
        try {
          if (controller.signal.aborted) return;
          if (splittingEnabled && file.size > CHUNK_TARGET_BYTES) {
            await uploadSplitFile(destination, file, index, key, controller);
          } else {
            await uploadRequest(destination, [file], [index], key, controller);
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
    const controller = controllers.get(batchId)!;

    let entriesToPack = entries;
    if (splittingEnabled) {
      const oversized = entries.filter((e) => e.file.size > CHUNK_TARGET_BYTES);
      entriesToPack = entries.filter((e) => e.file.size <= CHUNK_TARGET_BYTES);

      for (const entry of oversized) {
        promises.push(uploadSplitFile(destination, entry.file, entry.index, batchId, controller));
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
            await uploadRequest(destination, chunk, chunkIndices, batchId, controller);
          } finally {
            semaphore.release();
          }
        }),
      );
    }
  }

  const { t, tItem } = getTranslations();
  externals?.addToast(t('elements.fileUpload.toast.uploading', { files: tItem('file', files.length) }), 'success');

  await Promise.allSettled(promises);
}

export function cancelFileUpload(fileKey: string): void {
  const entry = useUploadsStore.getState().uploads.get(fileKey);
  if (!entry) return;

  const controller = controllers.get(fileKey);
  controller?.abort();
  controllers.delete(fileKey);
  pendingProgress.delete(fileKey);

  setUploads((prev) => {
    if (!prev.has(fileKey)) return prev;
    const next = new Map(prev);
    next.delete(fileKey);
    return next;
  });

  const { t } = getTranslations();
  externals?.addToast(t('elements.fileUpload.toast.cancelledFile', { file: entry.filePath }).md(), 'success');

  settleBatches();
}

export function cancelFolderUpload(scope: string, folderName: string): void {
  folderFileCounts.delete(folderCountKey(scope, folderName));

  const keysToRemove: string[] = [];
  const batchIds = new Set<string>();

  useUploadsStore.getState().uploads.forEach((file, key) => {
    if (uploadScopeKey(file.destination) === scope && file.filePath.split('/')[0] === folderName) {
      keysToRemove.push(key);
      batchIds.add(file.batchId);
    }
  });

  if (keysToRemove.length === 0) return;

  batchIds.forEach((batchId) => {
    controllers.get(batchId)?.abort();
    controllers.delete(batchId);
    failureToastedBatches.delete(batchId);
  });
  keysToRemove.forEach((key) => pendingProgress.delete(key));

  setUploads((prev) => {
    const next = new Map(prev);
    keysToRemove.forEach((key) => next.delete(key));
    return next;
  });

  const { t, tItem } = getTranslations();
  externals?.addToast(
    t('elements.fileUpload.toast.cancelledFolder', {
      folder: folderName,
      files: tItem('file', keysToRemove.length),
    }).md(),
    'success',
  );

  settleBatches();
}

export function cancelAllUploads(scope?: string, options?: { silent?: boolean }): void {
  const uploads = useUploadsStore.getState().uploads;

  const keysToRemove: string[] = [];
  const batchIds = new Set<string>();
  const destinations = new Map<string, UploadDestination>();

  uploads.forEach((file, key) => {
    const fileScope = uploadScopeKey(file.destination);
    if (scope !== undefined && fileScope !== scope) return;

    keysToRemove.push(key);
    batchIds.add(file.batchId);
    if (!destinations.has(fileScope)) destinations.set(fileScope, file.destination);
  });

  if (keysToRemove.length === 0) return;

  keysToRemove.forEach((key) => {
    controllers.get(key)?.abort();
    controllers.delete(key);
    pendingProgress.delete(key);
  });
  batchIds.forEach((batchId) => {
    controllers.get(batchId)?.abort();
    controllers.delete(batchId);
    failureToastedBatches.delete(batchId);
  });

  for (const countKey of [...folderFileCounts.keys()]) {
    if (scope === undefined || countKey.startsWith(`${scope}\n`)) folderFileCounts.delete(countKey);
  }

  setUploads((prev) => {
    const next = new Map(prev);
    keysToRemove.forEach((key) => next.delete(key));
    return next;
  });

  if (!options?.silent) {
    destinations.forEach((destination) => handlerFor(destination).onBatchComplete(destination));

    const { t } = getTranslations();
    externals?.addToast(t('elements.fileUpload.toast.cancelledAll', {}), 'success');
  }
}

window.addEventListener('beforeunload', (event) => {
  if (useUploadsStore.getState().uploads.size > 0) {
    event.preventDefault();
    event.returnValue = '';
  }
});

window.addEventListener('session-expired', () => {
  cancelAllUploads(undefined, { silent: true });
});
