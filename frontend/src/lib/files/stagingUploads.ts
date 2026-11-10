import type { StoreApi } from 'zustand';
import { basename, dirname, join } from 'pathe';
import type { FileManagerStore, StagingUpload } from '@/stores/fileManager.ts';
import { UploadItem, useUploadsStore } from '@/stores/uploads.ts';

const STALE_AFTER_MS = 30_000;

/**
 * Whether a staging upload has been sitting untouched long enough to count as abandoned. `now` is
 * passed in rather than read here so the React Compiler treats it as an input: a `Date.now()` call
 * in the body would be cached on `upload` alone and the result would never change again.
 */
export function isStalled(upload: StagingUpload, now: number): boolean {
  if (upload.active) return false;
  if (!upload.updated) return true;

  return now - upload.updated.getTime() > STALE_AFTER_MS;
}

export function localTargetPath(item: UploadItem, serverUuid: string): string | null {
  if (item.destination.type !== 'server' || item.destination.serverUuid !== serverUuid) return null;

  return join('/', item.destination.directory, item.remotePath ?? item.filePath);
}

export function anyStalledUpload(uploads: Map<string, StagingUpload>, now: number): boolean {
  for (const upload of uploads.values()) {
    if (isStalled(upload, now)) return true;
  }

  return false;
}

export function anyPausedUpload(items: Map<string, UploadItem>, serverUuid: string): boolean {
  for (const item of items.values()) {
    if (item.status === 'paused' && localTargetPath(item, serverUuid) !== null) return true;
  }

  return false;
}

export interface IncompleteUpload {
  name: string;
  directory: string;
  uploaded: number;
  total: number | null;
}

/**
 * The staging uploads that have stalled, plus the paused uploads this session still holds for the
 * server. A paused upload the daemon already reports as stalled is listed once, from the daemon.
 */
export function collectIncompleteUploads(
  uploads: Map<string, StagingUpload>,
  now: number,
  items: Map<string, UploadItem>,
  serverUuid: string,
): IncompleteUpload[] {
  const result: IncompleteUpload[] = [];

  for (const upload of uploads.values()) {
    if (!isStalled(upload, now)) continue;

    result.push({
      name: upload.targetName,
      directory: join('/', upload.directory),
      uploaded: upload.uploaded,
      total: upload.total,
    });
  }

  for (const item of items.values()) {
    if (item.status !== 'paused') continue;

    const path = localTargetPath(item, serverUuid);
    if (path === null) continue;

    const directory = dirname(path);
    const name = basename(path);
    if (result.some((entry) => entry.directory === directory && entry.name === name)) continue;

    result.push({ name, directory, uploaded: item.uploaded, total: item.size });
  }

  return result;
}

export function hasIncompleteUploads(store: StoreApi<FileManagerStore>): boolean {
  const state = store.getState();

  return (
    anyStalledUpload(state.stagingUploads, state.stagingUploadsNow) ||
    anyPausedUpload(useUploadsStore.getState().uploads, state.externals.serverUuid)
  );
}

function nextStaleAt(uploads: Map<string, StagingUpload>, now: number): number | null {
  let earliest: number | null = null;

  for (const upload of uploads.values()) {
    if (upload.active || !upload.updated) continue;

    const staleAt = upload.updated.getTime() + STALE_AFTER_MS;
    if (staleAt > now && (earliest === null || staleAt < earliest)) earliest = staleAt;
  }

  return earliest;
}

/**
 * Advances the clock {@link isStalled} reads, so an upload going stale repaints the rows watching
 * it. Nothing else can drive that: wings stops broadcasting once no upload is active, so the last
 * payload arrives while the upload still counts as fresh and no further event is coming. Only the
 * next deadline is ever scheduled, and entries that are active (rebroadcast every second) or carry
 * no `updated` at all (stale on arrival) need no timer.
 */
export function startStagingUploadsClock(store: StoreApi<FileManagerStore>): () => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    clearTimeout(timeout);

    const now = Date.now();
    const staleAt = nextStaleAt(store.getState().stagingUploads, now);
    if (staleAt === null) return;

    timeout = setTimeout(() => {
      store.getState().setStagingUploadsNow(Date.now());
      schedule();
    }, staleAt - now);
  };

  schedule();
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.stagingUploads !== previous.stagingUploads) schedule();
  });

  return () => {
    unsubscribe();
    clearTimeout(timeout);
  };
}
