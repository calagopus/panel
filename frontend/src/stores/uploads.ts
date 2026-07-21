import { ChangeEvent, RefObject } from 'react';
import { create } from 'zustand';

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error';

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
}

export interface AggregatedUploadProgress {
  totalSize: number;
  uploadedSize: number;
  fileCount: number;
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
