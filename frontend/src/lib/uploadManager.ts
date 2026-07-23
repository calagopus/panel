import { QueryClient } from '@tanstack/react-query';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { ReactNode } from 'react';
import uploadAssets from '@/api/admin/assets/uploadAssets.ts';
import { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl.ts';
import {
  conflictOffset,
  headUploadOffset,
  patchUploadChunk,
  withFileParam,
} from '@/api/server/files/resumableUpload.ts';
import { ToastAction, ToastType } from '@/providers/contexts/toastContext.ts';
import { getTranslations } from '@/providers/contexts/translationContext.ts';
import {
  loadPersistedUploads,
  PersistedResumableUpload,
  persistUpload,
  UploadDestination,
  UploadItem,
  unpersistUpload,
  uploadScopeKey,
  useUploadsStore,
} from '@/stores/uploads.ts';

export interface UploadResult {
  url: string;
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
      await axiosInstance.post(url, form, config);

      return { url };
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
// Files held in memory for the current session so a paused upload can resume without
// re-selecting. Cleared on a reload (which is what forces the re-select fallback).
const heldFiles = new Map<string, File>();
const folderFileCounts = new Map<string, number>();
const pendingProgress = new Map<string, number>();
const failureToastedBatches = new Set<string>();
const settledErrorBatches = new Set<string>();
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

function unpersistItem(item: UploadItem | undefined): void {
  if (item?.resumable && item.remotePath) {
    unpersistUpload(item.destination, item.remotePath);
  }
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
    errorKeys: Set<string>;
    destination: UploadDestination;
  }

  const batches = new Map<string, BatchInfo>();
  uploads.forEach((file, key) => {
    const entry = batches.get(file.batchId) ?? {
      allDone: true,
      hadError: false,
      keys: [],
      errorKeys: new Set<string>(),
      destination: file.destination,
    };
    entry.keys.push(key);

    if (file.status === 'error') {
      entry.hadError = true;
      entry.errorKeys.add(key);
    } else if (file.status !== 'completed') {
      entry.allDone = false;
    }
    batches.set(file.batchId, entry);
  });

  const keysToRemove: string[] = [];
  const completedBatches: BatchInfo[] = [];
  batches.forEach((batch, batchId) => {
    if (!batch.allDone) return;
    if (batch.hadError && settledErrorBatches.has(batchId)) return;

    keysToRemove.push(...batch.keys.filter((key) => !batch.errorKeys.has(key)));
    controllers.delete(batchId);
    batch.keys.forEach((key) => controllers.delete(key));
    failureToastedBatches.delete(batchId);
    if (batch.hadError) settledErrorBatches.add(batchId);
    completedBatches.push(batch);
  });

  if (keysToRemove.length === 0 && completedBatches.length === 0) return;

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

  if (keysToRemove.length > 0) {
    setUploads((prev) => {
      const next = new Map(prev);
      keysToRemove.forEach((key) => next.delete(key));
      return next;
    });
  }

  const scopes = new Map<string, { destination: UploadDestination; fileCount: number }>();
  completedBatches.forEach((batch) => {
    const scope = uploadScopeKey(batch.destination);
    const entry = scopes.get(scope) ?? { destination: batch.destination, fileCount: 0 };
    if (!batch.hadError) entry.fileCount += batch.keys.length;
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
    const { t } = getTranslations();
    externals?.addToast(t('elements.fileUpload.toast.failed', { error: httpErrorToHuman(error) }), 'error');
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

function markResumableError(key: string): void {
  setUploads((prev) => {
    const entry = prev.get(key);
    if (!entry || entry.status === 'completed') return prev;
    const next = new Map(prev);
    next.set(key, { ...entry, status: 'error' });
    return next;
  });
}

async function runResumableUpload(
  destination: Extract<UploadDestination, { type: 'server' }>,
  file: File,
  key: string,
  remotePath: string,
  batchId: string,
  controller: AbortController,
): Promise<void> {
  const totalSize = file.size;
  const signal = controller.signal;
  heldFiles.set(key, file);

  try {
    setUploads((prev) => {
      const entry = prev.get(key);
      if (!entry || entry.status === 'completed' || entry.status === 'error') return prev;
      const next = new Map(prev);
      next.set(key, { ...entry, status: 'uploading', detached: false, retryAttempt: 0 });
      return next;
    });

    persistUpload({ destination, remotePath, localName: file.name, size: totalSize });

    const refreshUrl = async (): Promise<string> =>
      withFileParam((await getFileUploadUrl(destination.serverUuid, destination.directory)).url, remotePath);

    let uploadUrl = await refreshUrl();

    let offset = await headUploadOffset(uploadUrl, signal);
    if (offset > totalSize) offset = 0;
    queueProgress(key, Math.min(offset, totalSize));

    let finalized = false;
    while (!finalized) {
      if (signal.aborted) throw makeCancelled();

      const sliceStart = offset;
      const sliceEnd = Math.min(sliceStart + CHUNK_TARGET_BYTES, totalSize);
      const isLast = sliceEnd >= totalSize;
      const body = file.slice(sliceStart, sliceEnd);

      let sliceDone = false;
      for (let attempt = 0; !sliceDone; attempt++) {
        if (signal.aborted) throw makeCancelled();

        try {
          offset = await patchUploadChunk(uploadUrl, body, sliceStart, totalSize, isLast, signal, (event) =>
            queueProgress(key, Math.min(sliceStart + (event.loaded ?? 0), totalSize)),
          );
          if (isLast) finalized = true;
          sliceDone = true;
        } catch (err) {
          if (!(err instanceof AxiosError) || signal.aborted) throw err;

          const status = err.response?.status;
          if (status === 401) {
            uploadUrl = await refreshUrl();
            attempt--;
          } else if (status === 409) {
            const real = conflictOffset(err.response?.headers as Record<string, unknown> | undefined);
            offset = real !== null ? Math.min(real, totalSize) : sliceStart;
            sliceDone = true;
          } else if (is429Error(err) && attempt < MAX_RETRIES) {
            setUploads((prev) => {
              const entry = prev.get(key);
              if (!entry) return prev;
              const next = new Map(prev);
              next.set(key, { ...entry, retryAttempt: attempt + 1 });
              return next;
            });
            await sleep(get429RetryDelay(err, attempt), signal);
          } else {
            throw err;
          }
        }
      }
    }

    unpersistUpload(destination, remotePath);
    heldFiles.delete(key);
    setUploads((prev) => {
      const entry = prev.get(key);
      if (!entry || entry.status === 'error') return prev;
      const next = new Map(prev);
      next.set(key, { ...entry, progress: 100, uploaded: entry.size, status: 'completed' });
      return next;
    });
  } catch (error) {
    // A pause aborts the request but keeps the entry `paused` and the File held for resume; do
    // not fall through to the error state in that case.
    if (isCancelledError(error) && useUploadsStore.getState().uploads.get(key)?.status === 'paused') {
      return;
    }
    // The descriptor is left persisted on failure so the upload can be resumed (in-session, or
    // after a reload); an explicit cancel is what removes it.
    handleUploadError(error, batchId, () => markResumableError(key));
  } finally {
    settleBatches();
  }
}

/**
 * Pauses an in-flight resumable upload: aborts the current request but keeps the entry (with
 * its progress) and the held File, so it can resume without re-selecting. The daemon keeps the
 * partial file, so the next resume continues from its on-disk offset.
 */
export function pauseUpload(key: string): void {
  const entry = useUploadsStore.getState().uploads.get(key);
  // Only once the upload is actually running (its File is held and it has been persisted) can it
  // be paused; a still-`pending` item would have nothing to resume from.
  if (!entry?.resumable || entry.status !== 'uploading') return;

  setUploads((prev) => {
    const current = prev.get(key);
    if (!current) return prev;
    const next = new Map(prev);
    next.set(key, { ...current, status: 'paused', retryAttempt: 0 });
    return next;
  });

  controllers.get(key)?.abort();
  controllers.delete(key);
  pendingProgress.delete(key);
}

/**
 * Resumes a paused upload whose File is still held from this session. Returns false when the
 * File is gone (e.g. after a reload), in which case the caller must re-select it via
 * {@link resumeDetachedUpload}.
 */
export function resumeUpload(key: string): boolean {
  const entry = useUploadsStore.getState().uploads.get(key);
  if (!entry?.resumable || entry.destination.type !== 'server' || !entry.remotePath) return false;

  const file = heldFiles.get(key);
  if (!file) return false;

  const controller = new AbortController();
  controllers.set(key, controller);

  runResumableUpload(entry.destination, file, key, entry.remotePath, entry.batchId, controller).catch((error) =>
    console.error('Resume error:', error),
  );

  return true;
}

/** Whether a paused upload can resume without a re-select (its File is still in memory). */
export function canResumeInSession(key: string): boolean {
  return heldFiles.has(key);
}

function makeCancelled(): Error & { code?: string } {
  const err: Error & { code?: string } = new Error('canceled');
  err.code = 'ERR_CANCELED';
  return err;
}

async function uploadResumableFile(
  destination: UploadDestination,
  file: File,
  fileIndex: number,
  batchId: string,
  controller: AbortController,
): Promise<void> {
  if (destination.type !== 'server') {
    throw new Error('uploadResumableFile called for a destination without resumable support');
  }

  const remotePath = file.webkitRelativePath || file.name;
  await runResumableUpload(destination, file, `file-${fileIndex}`, remotePath, batchId, controller);
}

export function resumeDetachedUpload(key: string, file: File): boolean {
  const entry = useUploadsStore.getState().uploads.get(key);
  if (!entry || !entry.resumable || entry.destination.type !== 'server' || !entry.remotePath) return false;

  if (file.name !== entry.localName || file.size !== entry.size) {
    const { t } = getTranslations();
    addToastSafely(t('elements.fileUpload.toast.wrongFile', { file: entry.localName ?? file.name }).md(), 'error');
    return false;
  }

  const controller = new AbortController();
  controllers.set(key, controller);

  runResumableUpload(entry.destination, file, key, entry.remotePath, entry.batchId, controller).catch((error) =>
    console.error('Resume error:', error),
  );

  return true;
}

function addToastSafely(message: ReactNode, type?: ToastType): void {
  externals?.addToast(message, type);
}

let hydratedPersistedUploads = false;
export function hydratePersistedUploads(): void {
  if (hydratedPersistedUploads) return;
  hydratedPersistedUploads = true;

  const persisted = loadPersistedUploads();
  if (persisted.length === 0) return;

  const startIndex = fileIndexCounter;
  fileIndexCounter += persisted.length;

  setUploads((prev) => {
    const next = new Map(prev);
    persisted.forEach((entry: PersistedResumableUpload, i) => {
      const key = `file-${startIndex + i}`;
      const scope = uploadScopeKey(entry.destination);
      next.set(key, {
        filePath: entry.remotePath,
        progress: 0,
        size: entry.size,
        uploaded: 0,
        batchId: `${scope}/detached-${entry.remotePath}`,
        status: 'paused',
        retryAttempt: 0,
        destination: entry.destination,
        resumable: true,
        remotePath: entry.remotePath,
        localName: entry.localName,
        detached: true,
      });
    });
    return next;
  });
}

function clearFailedEntries(scope: string, folderNames: Set<string>, fileNames: Set<string>): void {
  const keysToRemove: string[] = [];
  const removedPerFolder = new Map<string, number>();
  const affectedBatches = new Set<string>();

  useUploadsStore.getState().uploads.forEach((file, key) => {
    if (file.status !== 'error' || uploadScopeKey(file.destination) !== scope) return;

    const folder = file.filePath.includes('/') ? file.filePath.split('/')[0] : null;
    if (folder !== null ? !folderNames.has(folder) : !fileNames.has(file.filePath)) return;

    keysToRemove.push(key);
    affectedBatches.add(file.batchId);
    if (folder !== null) removedPerFolder.set(folder, (removedPerFolder.get(folder) ?? 0) + 1);
  });

  if (keysToRemove.length === 0) return;

  setUploads((prev) => {
    const next = new Map(prev);
    keysToRemove.forEach((key) => {
      unpersistItem(next.get(key));
      next.delete(key);
    });
    return next;
  });

  removedPerFolder.forEach((removed, folder) => {
    const countKey = folderCountKey(scope, folder);
    const remaining = (folderFileCounts.get(countKey) ?? 0) - removed;
    if (remaining > 0) folderFileCounts.set(countKey, remaining);
    else folderFileCounts.delete(countKey);
  });

  const remaining = useUploadsStore.getState().uploads;
  affectedBatches.forEach((batchId) => {
    let batchHasEntries = false;
    remaining.forEach((file) => {
      if (file.batchId === batchId) batchHasEntries = true;
    });
    if (!batchHasEntries) {
      settledErrorBatches.delete(batchId);
      failureToastedBatches.delete(batchId);
    }
  });
}

export async function uploadFiles(destination: UploadDestination, files: File[]): Promise<void> {
  if (files.length === 0) return;

  const scope = uploadScopeKey(destination);
  const splittingEnabled = destination.type === 'server';
  const resumableFields = (file: File, path: string): Partial<UploadItem> =>
    splittingEnabled && file.size > CHUNK_TARGET_BYTES
      ? { resumable: true, remotePath: path, localName: file.name }
      : {};

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

  clearFailedEntries(scope, new Set(folderCounts.keys()), new Set(individualFiles.map(({ file }) => file.name)));

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
        ...resumableFields(file, file.name),
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
        ...resumableFields(file, path),
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
            await uploadResumableFile(destination, file, index, key, controller);
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
        promises.push(uploadResumableFile(destination, entry.file, entry.index, batchId, controller));
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
  heldFiles.delete(fileKey);
  unpersistItem(entry);

  setUploads((prev) => {
    if (!prev.has(fileKey)) return prev;
    const next = new Map(prev);
    next.delete(fileKey);
    return next;
  });

  let batchHasEntries = false;
  useUploadsStore.getState().uploads.forEach((file) => {
    if (file.batchId === entry.batchId) batchHasEntries = true;
  });
  if (!batchHasEntries) settledErrorBatches.delete(entry.batchId);

  if (entry.status !== 'error') {
    const { t } = getTranslations();
    externals?.addToast(t('elements.fileUpload.toast.cancelledFile', { file: entry.filePath }).md(), 'success');
  }

  settleBatches();
}

export function cancelFolderUpload(scope: string, folderName: string): void {
  folderFileCounts.delete(folderCountKey(scope, folderName));

  const keysToRemove: string[] = [];
  const batchIds = new Set<string>();
  let cancelledCount = 0;

  useUploadsStore.getState().uploads.forEach((file, key) => {
    if (uploadScopeKey(file.destination) === scope && file.filePath.split('/')[0] === folderName) {
      keysToRemove.push(key);
      batchIds.add(file.batchId);
      if (file.status !== 'error') cancelledCount++;
    }
  });

  if (keysToRemove.length === 0) return;

  batchIds.forEach((batchId) => {
    controllers.get(batchId)?.abort();
    controllers.delete(batchId);
    failureToastedBatches.delete(batchId);
    settledErrorBatches.delete(batchId);
  });
  keysToRemove.forEach((key) => pendingProgress.delete(key));

  setUploads((prev) => {
    const next = new Map(prev);
    keysToRemove.forEach((key) => {
      unpersistItem(next.get(key));
      heldFiles.delete(key);
      next.delete(key);
    });
    return next;
  });

  if (cancelledCount > 0) {
    const { t, tItem } = getTranslations();
    externals?.addToast(
      t('elements.fileUpload.toast.cancelledFolder', {
        folder: folderName,
        files: tItem('file', cancelledCount),
      }).md(),
      'success',
    );
  }

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
    settledErrorBatches.delete(batchId);
  });

  for (const countKey of [...folderFileCounts.keys()]) {
    if (scope === undefined || countKey.startsWith(`${scope}\n`)) folderFileCounts.delete(countKey);
  }

  setUploads((prev) => {
    const next = new Map(prev);
    keysToRemove.forEach((key) => {
      if (!options?.silent) unpersistItem(next.get(key));
      heldFiles.delete(key);
      next.delete(key);
    });
    return next;
  });

  if (!options?.silent) {
    destinations.forEach((destination) => handlerFor(destination).onBatchComplete(destination));

    const { t } = getTranslations();
    externals?.addToast(t('elements.fileUpload.toast.cancelledAll', {}), 'success');
  }
}

window.addEventListener('beforeunload', (event) => {
  let hasActiveUploads = false;
  useUploadsStore.getState().uploads.forEach((file) => {
    if (file.status === 'pending' || file.status === 'uploading') hasActiveUploads = true;
  });

  if (hasActiveUploads) {
    event.preventDefault();
    event.returnValue = '';
  }
});

window.addEventListener('session-expired', () => {
  cancelAllUploads(undefined, { silent: true });
});
