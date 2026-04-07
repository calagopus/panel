import { createContext, RefObject, useContext } from 'react';
import { z } from 'zod';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import {
  serverDirectoryEntrySchema,
  serverDirectorySortingModeSchema,
  serverFilesSearchSchema,
} from '@/lib/schemas/server/files.ts';
import { FileUploader } from '@/plugins/useFileUpload.ts';

export type ModalType =
  | 'rename'
  | 'copy'
  | 'copy-remote'
  | 'fingerprint'
  | 'permissions'
  | 'archive'
  | 'delete'
  | 'sftpDetails'
  | 'details'
  | 'nameDirectory'
  | 'pullFile'
  | 'search'
  | null;

export interface SearchInfo {
  query?: string;
  filters: z.infer<typeof serverFilesSearchSchema>;
}

export type ActingFileMode = 'copy' | 'move';

export interface FileManagerContextType {
  isLoading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;

  actingMode: ActingFileMode | null;
  actingFiles: ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>;
  actingFilesSource: string | null;
  selectedFiles: ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>;
  browsingBackup: z.infer<typeof serverBackupSchema> | null;
  setBrowsingBackup: (backup: z.infer<typeof serverBackupSchema> | null) => void;
  browsingDirectory: string;
  setBrowsingDirectory: (directory: string) => void;
  browsingEntries: Pagination<z.infer<typeof serverDirectoryEntrySchema>>;
  setBrowsingEntries: (entries: Pagination<z.infer<typeof serverDirectoryEntrySchema>>) => void;
  page: number;
  setPage: (page: number) => void;
  browsingWritableDirectory: boolean;
  setBrowsingWritableDirectory: (state: boolean) => void;
  browsingFastDirectory: boolean;
  setBrowsingFastDirectory: (state: boolean) => void;
  openModal: ModalType;
  setOpenModal: (modal: ModalType) => void;
  modalDirectoryEntries: z.infer<typeof serverDirectoryEntrySchema>[];
  setModalDirectoryEntries: (files: z.infer<typeof serverDirectoryEntrySchema>[]) => void;
  searchInfo: SearchInfo | null;
  setSearchInfo: (info: SearchInfo | null) => void;

  sortMode: z.infer<typeof serverDirectorySortingModeSchema>;
  setSortMode: (sortMode: z.infer<typeof serverDirectorySortingModeSchema>) => void;
  clickOnce: boolean;
  setClickOnce: (state: boolean) => void;
  preferPhysicalSize: boolean;
  setPreferPhysicalSize: (state: boolean) => void;
  editorMinimap: boolean;
  setEditorMinimap: (state: boolean) => void;
  editorLineOverflow: boolean;
  setEditorLineOverflow: (state: boolean) => void;
  imageViewerSmoothing: boolean;
  setImageViewerSmoothing: (state: boolean) => void;

  resetEntries: () => void;
  invalidateFilemanager: () => void;
  fileUploader: FileUploader;
  doActFiles: (mode: ActingFileMode | null, files: z.infer<typeof serverDirectoryEntrySchema>[]) => void;
  clearActingFiles: () => void;
  doSelectFiles: (files: z.infer<typeof serverDirectoryEntrySchema>[]) => void;
  addSelectedFile: (file: z.infer<typeof serverDirectoryEntrySchema>) => void;
  removeSelectedFile: (file: z.infer<typeof serverDirectoryEntrySchema>) => void;
  doOpenModal: (modal: ModalType, entries?: z.infer<typeof serverDirectoryEntrySchema>[]) => void;
  doCloseModal: () => void;
}

export const FileManagerContext = createContext<FileManagerContextType | undefined>(undefined);

export const useFileManager = () => {
  const context = useContext(FileManagerContext);
  if (!context) {
    throw new Error('useFileManager must be used within a FileManagerProvider');
  }
  return context;
};

export const getFileManager = (): FileManagerContextType => {
  const context = (FileManagerContext as never)['_currentValue'] as FileManagerContextType | undefined;
  if (!context) {
    throw new Error('getFileManager must be used within a FileManagerProvider');
  }
  return context;
};
