import { ChangeEvent, RefObject } from 'react';
import { create } from 'zustand';

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error' | 'paused';

export type UploadDestination =
  | { type: 'server'; serverUuid: string; serverName: string; routeId: string; directory: string }
  | { type: 'adminAsset'; directory: string };

export function uploadScopeKey(destination: UploadDestination): string {
  return destination.type === 'server' ? `server:${destination.serverUuid}` : 'adminAsset';
}

export interface UploadItem {
  filePath: string;
  progress: number;
  size: number;
  uploaded: number;
  batchId: string;
  status: UploadStatus;
  retryAttempt: number;
  destination: UploadDestination;

  resumable?: boolean;
  remotePath?: string;
  localName?: string;
  detached?: boolean;
}

export interface AggregatedUploadProgress {
  totalSize: number;
  uploadedSize: number;
  fileCount: number;
  erroredCount: number;
  activeCount: number;
}

export interface FileUploader {
  uploadingFiles: Map<string, UploadItem>;
  aggregatedUploadProgress: Map<string, AggregatedUploadProgress>;
  totalUploadProgress: number;
  uploadFiles: (files: File[]) => Promise<void>;
  uploadFilesToDirectory: (directory: string, files: File[]) => Promise<void>;
  cancelFileUpload: (fileKey: string) => void;
  cancelFolderUpload: (folderName: string) => void;
  cancelAllUploads: () => void;
  handleFileSelect: (event: ChangeEvent<HTMLInputElement>, inputRef: RefObject<HTMLInputElement | null>) => void;
  handleFolderSelect: (event: ChangeEvent<HTMLInputElement>, inputRef: RefObject<HTMLInputElement | null>) => void;
}

interface UploadsStore {
  uploads: Map<string, UploadItem>;
}

export const useUploadsStore = create<UploadsStore>()(() => ({
  uploads: new Map<string, UploadItem>(),
}));

export interface PersistedResumableUpload {
  destination: Extract<UploadDestination, { type: 'server' }>;
  remotePath: string;
  localName: string;
  size: number;
  owner?: string;
  heartbeat?: number;
}

const PERSIST_KEY = 'resumable-uploads';
const TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
const HEARTBEAT_MS = 5_000;
const OWNER_TTL_MS = 20_000;

export function persistedUploadId(destination: UploadDestination, remotePath: string): string {
  return `${uploadScopeKey(destination)}\n${destination.directory}\n${remotePath}`;
}

function readPersisted(): Map<string, PersistedResumableUpload> {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return new Map();

    const parsed = JSON.parse(raw) as PersistedResumableUpload[];
    const map = new Map<string, PersistedResumableUpload>();
    for (const entry of parsed) {
      if (entry?.destination?.type === 'server' && typeof entry.remotePath === 'string') {
        map.set(persistedUploadId(entry.destination, entry.remotePath), entry);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function writePersisted(map: Map<string, PersistedResumableUpload>): void {
  try {
    if (map.size === 0) {
      localStorage.removeItem(PERSIST_KEY);
    } else {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(Array.from(map.values())));
    }
  } catch {
    // persistence is best-effort.
  }
}

function isOwnedElsewhere(entry: PersistedResumableUpload): boolean {
  return !!entry.owner && entry.owner !== TAB_ID && Date.now() - (entry.heartbeat ?? 0) < OWNER_TTL_MS;
}

export function loadPersistedUploads(): PersistedResumableUpload[] {
  return Array.from(readPersisted().values()).filter((entry) => !isOwnedElsewhere(entry));
}

export function isPersistedUploadOwnedElsewhere(destination: UploadDestination, remotePath: string): boolean {
  const entry = readPersisted().get(persistedUploadId(destination, remotePath));
  return !!entry && isOwnedElsewhere(entry);
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function ensureHeartbeat(): void {
  if (heartbeatTimer !== null) return;

  heartbeatTimer = setInterval(() => {
    const map = readPersisted();
    const now = Date.now();
    let owned = false;
    map.forEach((entry) => {
      if (entry.owner !== TAB_ID) return;
      entry.heartbeat = now;
      owned = true;
    });

    if (owned) {
      writePersisted(map);
    } else if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }, HEARTBEAT_MS);
}

export function persistUpload(entry: Omit<PersistedResumableUpload, 'owner' | 'heartbeat'>): void {
  const map = readPersisted();
  map.set(persistedUploadId(entry.destination, entry.remotePath), { ...entry, owner: TAB_ID, heartbeat: Date.now() });
  writePersisted(map);
  ensureHeartbeat();
}

window.addEventListener('pagehide', () => {
  const map = readPersisted();
  let changed = false;
  map.forEach((entry) => {
    if (entry.owner !== TAB_ID) return;
    entry.heartbeat = 0;
    changed = true;
  });
  if (changed) writePersisted(map);
});

export function unpersistUpload(destination: UploadDestination, remotePath: string): void {
  const map = readPersisted();
  if (map.delete(persistedUploadId(destination, remotePath))) {
    writePersisted(map);
  }
}
