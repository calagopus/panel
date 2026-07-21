import { QueryClient } from '@tanstack/react-query';
import { createRef, RefObject, startTransition } from 'react';
import { z } from 'zod';
import { create, StoreApi } from 'zustand';
import { createContext } from 'zustand-utils';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import { DirectoryResponse } from '@/api/server/files/loadDirectory.ts';
import searchFiles from '@/api/server/files/searchFiles.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import {
  serverDirectoryEntrySchema,
  serverDirectorySortingModeSchema,
  serverFilesSearchSchema,
} from '@/lib/schemas/server/files.ts';
import { FileUploader } from '@/stores/uploads.ts';

export type ModalType =
  | 'rename'
  | 'mass-rename'
  | 'copy'
  | 'copy-remote'
  | 'fingerprint'
  | 'permissions'
  | 'archive'
  | 'delete'
  | 'details'
  | 'nameDirectory'
  | 'pullFile'
  | 'search'
  | 'largestDirectories'
  | null;

export interface SearchInfo {
  query?: string;
  filters: z.infer<typeof serverFilesSearchSchema>;
}

export type ActingFileMode = 'copy' | 'move';

export interface FileManagerExternals {
  serverUuid: string;
  queryClient: QueryClient;
  directoryData: DirectoryResponse | null;
}

export interface FileManagerStore {
  isLoading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;

  actingMode: ActingFileMode | null;
  actingFiles: ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>;
  actingFilesSource: string | null;
  draggingFiles: ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>;
  draggingFilesSource: string | null;
  draggingTarget: string | null;
  selectedFiles: ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>;
  browsingBackup: z.infer<typeof serverBackupSchema> | null;
  browsingDirectory: string;
  setBrowsingDirectory: (directory: string) => void;
  browsingEntries: Pagination<z.infer<typeof serverDirectoryEntrySchema>>;
  setBrowsingEntries: (entries: Pagination<z.infer<typeof serverDirectoryEntrySchema>>) => void;
  browsingError: string | null;
  setBrowsingError: (error: string | null) => void;
  page: number;
  setPage: (page: number) => void;
  browsingPrimaryFilesystem: boolean;
  setBrowsingPrimaryFilesystem: (state: boolean) => void;
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
  editorFontSize: number;
  setEditorFontSize: (size: number) => void;
  vscodeUriScheme: string;
  setVscodeUriScheme: (scheme: string) => void;
  imageViewerSmoothing: boolean;
  setImageViewerSmoothing: (state: boolean) => void;
  audioPlayerVolume: number;
  setAudioPlayerVolume: (volume: number) => void;
  audioPlayerPlaybackRate: number;
  setAudioPlayerPlaybackRate: (rate: number) => void;

  resetEntries: () => void;
  invalidateFilemanager: () => void;
  fileUploader: FileUploader;
  doActFiles: (mode: ActingFileMode | null, files: z.infer<typeof serverDirectoryEntrySchema>[]) => void;
  clearActingFiles: () => void;
  doDragFiles: (files: z.infer<typeof serverDirectoryEntrySchema>[]) => void;
  clearDraggingFiles: () => void;
  setDraggingTarget: (directory: string | null) => void;
  doSelectFiles: (files: z.infer<typeof serverDirectoryEntrySchema>[]) => void;
  selectFile: (file: z.infer<typeof serverDirectoryEntrySchema>) => void;
  toggleSelectedFile: (file: z.infer<typeof serverDirectoryEntrySchema>) => void;
  selectFileRange: (file: z.infer<typeof serverDirectoryEntrySchema>) => void;
  addSelectedFile: (file: z.infer<typeof serverDirectoryEntrySchema>) => void;
  removeSelectedFile: (file: z.infer<typeof serverDirectoryEntrySchema>) => void;
  doOpenModal: (modal: ModalType, entries?: z.infer<typeof serverDirectoryEntrySchema>[]) => void;
  doCloseModal: () => void;
}

export type FileManagerContextType = FileManagerStore;

const noopFileUploader: FileUploader = {
  uploadingFiles: new Map(),
  aggregatedUploadProgress: new Map(),
  totalUploadProgress: 0,
  uploadFiles: async () => undefined,
  cancelFileUpload: () => undefined,
  cancelFolderUpload: () => undefined,
  cancelAllUploads: () => undefined,
  handleFileSelect: () => undefined,
  handleFolderSelect: () => undefined,
};

const { Provider, useStore, useStoreApi } = createContext<StoreApi<FileManagerStore>>();

export const createFileManagerStore = (
  getExternals: () => FileManagerExternals,
  initial: { browsingDirectory: string; page: number },
) =>
  create<FileManagerStore>()((set, get) => {
    let selectionAnchor: z.infer<typeof serverDirectoryEntrySchema> | null = null;

    return {
      isLoading: true,
      fileInputRef: createRef<HTMLInputElement>(),
      folderInputRef: createRef<HTMLInputElement>(),

      actingMode: null,
      actingFiles: new ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>('name'),
      actingFilesSource: null,
      draggingFiles: new ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>('name'),
      draggingFilesSource: null,
      draggingTarget: null,
      selectedFiles: new ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>('name'),
      browsingBackup: null,
      browsingDirectory: initial.browsingDirectory,
      setBrowsingDirectory: (directory) =>
        set((state) => {
          if (state.browsingDirectory === directory) return state;

          selectionAnchor = null;
          return { browsingDirectory: directory, selectedFiles: new ObjectSet('name') };
        }),
      browsingEntries: getEmptyPaginationSet<z.infer<typeof serverDirectoryEntrySchema>>(),
      setBrowsingEntries: (entries) => set({ browsingEntries: entries }),
      browsingError: null,
      setBrowsingError: (error) => set({ browsingError: error }),
      page: initial.page,
      setPage: (page) => set((state) => (state.page === page ? state : { page })),
      browsingPrimaryFilesystem: true,
      setBrowsingPrimaryFilesystem: (state) => set({ browsingPrimaryFilesystem: state }),
      browsingWritableDirectory: true,
      setBrowsingWritableDirectory: (state) => set({ browsingWritableDirectory: state }),
      browsingFastDirectory: true,
      setBrowsingFastDirectory: (state) => set({ browsingFastDirectory: state }),
      openModal: null,
      setOpenModal: (modal) => set({ openModal: modal }),
      modalDirectoryEntries: [],
      setModalDirectoryEntries: (files) => set({ modalDirectoryEntries: files }),
      searchInfo: null,
      setSearchInfo: (info) => set({ searchInfo: info }),

      sortMode:
        serverDirectorySortingModeSchema.safeParse(localStorage.getItem('file_sorting_mode')).data ?? 'name_asc',
      setSortMode: (sortMode) => {
        localStorage.setItem('file_sorting_mode', sortMode);
        set({ sortMode });
      },
      clickOnce: localStorage.getItem('file_click_once') !== 'false',
      setClickOnce: (state) => {
        localStorage.setItem('file_click_once', state.toString());
        set({ clickOnce: state });
      },
      preferPhysicalSize: localStorage.getItem('file_prefer_physical_size') === 'true',
      setPreferPhysicalSize: (state) => {
        localStorage.setItem('file_prefer_physical_size', state.toString());
        set({ preferPhysicalSize: state });
      },
      editorMinimap: localStorage.getItem('file_editor_minimap') === 'true',
      setEditorMinimap: (state) => {
        localStorage.setItem('file_editor_minimap', state.toString());
        set({ editorMinimap: state });
      },
      editorLineOverflow: localStorage.getItem('file_editor_lineoverflow') === 'true',
      setEditorLineOverflow: (state) => {
        localStorage.setItem('file_editor_lineoverflow', state.toString());
        set({ editorLineOverflow: state });
      },
      editorFontSize: Number(localStorage.getItem('file_editor_font_size')) || 14,
      setEditorFontSize: (size) => {
        localStorage.setItem('file_editor_font_size', size.toString());
        set({ editorFontSize: size });
      },
      vscodeUriScheme: localStorage.getItem('file_vscode_uri_scheme') || 'vscode',
      setVscodeUriScheme: (scheme) => {
        localStorage.setItem('file_vscode_uri_scheme', scheme);
        set({ vscodeUriScheme: scheme });
      },
      imageViewerSmoothing: localStorage.getItem('file_image_viewer_smoothing') !== 'false',
      setImageViewerSmoothing: (state) => {
        localStorage.setItem('file_image_viewer_smoothing', state.toString());
        set({ imageViewerSmoothing: state });
      },
      audioPlayerVolume: Number(localStorage.getItem('file_audio_player_volume')) || 0.5,
      setAudioPlayerVolume: (volume) => {
        localStorage.setItem('file_audio_player_volume', volume.toString());
        set({ audioPlayerVolume: volume });
      },
      audioPlayerPlaybackRate: Number(localStorage.getItem('file_audio_player_playback_rate')) || 1,
      setAudioPlayerPlaybackRate: (rate) => {
        localStorage.setItem('file_audio_player_playback_rate', rate.toString());
        set({ audioPlayerPlaybackRate: rate });
      },

      resetEntries: () => {
        const { directoryData } = getExternals();
        if (!directoryData) return;

        set({ browsingEntries: directoryData.entries });
      },
      invalidateFilemanager: () => {
        const { searchInfo, browsingDirectory, doSelectFiles, clearActingFiles } = get();
        const { serverUuid, queryClient } = getExternals();

        if (searchInfo) {
          searchFiles(serverUuid, { root: browsingDirectory, ...searchInfo.filters }).then((entries) => {
            startTransition(() => {
              set({ browsingEntries: { total: entries.length, page: 1, perPage: entries.length, data: entries } });
              doSelectFiles([]);
              clearActingFiles();
            });
          });
          return;
        }

        queryClient
          .invalidateQueries({
            queryKey: ['server', serverUuid, 'files'],
          })
          .catch((e) => console.error(e));
      },
      fileUploader: noopFileUploader,
      doActFiles: (mode, files) =>
        set((state) => ({
          actingMode: mode,
          actingFiles: new ObjectSet('name', files),
          actingFilesSource: state.browsingDirectory,
        })),
      clearActingFiles: () =>
        set({
          actingMode: null,
          actingFiles: new ObjectSet('name'),
          actingFilesSource: null,
        }),
      doDragFiles: (files) =>
        set((state) => ({
          draggingFiles: new ObjectSet('name', files),
          draggingFilesSource: state.browsingDirectory,
          draggingTarget: null,
        })),
      clearDraggingFiles: () =>
        set({
          draggingFiles: new ObjectSet('name'),
          draggingFilesSource: null,
          draggingTarget: null,
        }),
      setDraggingTarget: (directory) =>
        set((state) => (state.draggingTarget === directory ? state : { draggingTarget: directory })),
      doSelectFiles: (files) => set({ selectedFiles: new ObjectSet('name', files) }),
      selectFile: (file) => {
        selectionAnchor = file;
        set({ selectedFiles: new ObjectSet('name', [file]) });
      },
      toggleSelectedFile: (file) => {
        selectionAnchor = file;
        set((state) => {
          const next = state.selectedFiles.clone();
          if (next.has(file)) {
            next.delete(file);
          } else {
            next.add(file);
          }
          return { selectedFiles: next };
        });
      },
      selectFileRange: (file) => {
        const entries = get().browsingEntries.data;
        const targetIndex = entries.findIndex((entry) => entry.name === file.name);
        if (targetIndex === -1) return;

        const anchorIndex = selectionAnchor ? entries.findIndex((entry) => entry.name === selectionAnchor!.name) : -1;
        if (anchorIndex === -1) {
          get().selectFile(file);
          return;
        }

        const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        set({ selectedFiles: new ObjectSet('name', entries.slice(start, end + 1)) });
      },
      addSelectedFile: (file) => set((state) => ({ selectedFiles: state.selectedFiles.clone().add(file) })),
      removeSelectedFile: (file) =>
        set((state) => {
          const next = state.selectedFiles.clone();
          next.delete(file);
          return { selectedFiles: next };
        }),
      doOpenModal: (modal, entries) =>
        set((state) => ({
          openModal: modal,
          modalDirectoryEntries: entries ?? state.modalDirectoryEntries,
        })),
      doCloseModal: () =>
        set({
          openModal: null,
          modalDirectoryEntries: [],
        }),
    };
  });

export const FileManagerStoreContextProvider = Provider;
export const useFileManagerStore = useStore;
export const useFileManagerApi = useStoreApi;

export function useFileManager(): FileManagerStore;
export function useFileManager<T>(selector: (state: FileManagerStore) => T): T;
export function useFileManager<T>(selector?: (state: FileManagerStore) => T) {
  return useFileManagerStore(selector as (state: FileManagerStore) => T);
}
