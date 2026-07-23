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
}

const PERSIST_KEY = 'resumable-uploads';

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

export function loadPersistedUploads(): PersistedResumableUpload[] {
  return Array.from(readPersisted().values());
}

export function persistUpload(entry: PersistedResumableUpload): void {
  const map = readPersisted();
  map.set(persistedUploadId(entry.destination, entry.remotePath), entry);
  writePersisted(map);
}

export function unpersistUpload(destination: UploadDestination, remotePath: string): void {
  const map = readPersisted();
  if (map.delete(persistedUploadId(destination, remotePath))) {
    writePersisted(map);
  }
}
