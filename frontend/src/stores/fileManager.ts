import { InfiniteData, QueryClient } from '@tanstack/react-query';
import { createRef, RefObject, startTransition } from 'react';
import { z } from 'zod';
import { create, StoreApi } from 'zustand';
import { createContext } from 'zustand-utils';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import { DirectoryResponse } from '@/api/server/files/loadDirectory.ts';
import searchFiles from '@/api/server/files/searchFiles.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import {
  serverDirectoryEntrySchema,
  serverDirectorySortingModeSchema,
  serverFilesSearchSchema,
} from '@/lib/schemas/server/files.ts';
import {
  DEVICE_ONLY_SETTING_KEYS,
  getUserSetting,
  setUserSetting,
  setUserSettingLocal,
  subscribeUserSetting,
} from '@/lib/userSettings.ts';
import { FileUploader } from '@/stores/uploads.ts';

export type ModalType =
  | 'rename'
  | 'mass-rename'
  | 'copy'
  | 'copy-remote'
  | 'fingerprint'
  | 'permissions'
  | 'archive'
  | 'extract'
  | 'delete'
  | 'details'
  | 'nameDirectory'
  | 'nameSymlink'
  | 'pullFile'
  | 'search'
  | 'largestDirectories'
  | 'sftp'
  | null;

export interface SearchInfo {
  query?: string;
  filters: z.infer<typeof serverFilesSearchSchema>;
}

export type ActingFileMode = 'copy' | 'move';

export interface FileManagerExternals {
  serverUuid: string;
  serverName: string;
  routeId: string;
  queryClient: QueryClient;
  directoryData: DirectoryResponse | null;
}

export interface FileManagerStore {
  externals: FileManagerExternals;
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
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
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
  editorEngine: 'monaco' | 'pierre';
  setEditorEngine: (engine: 'monaco' | 'pierre') => void;
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

const booleanSchema = z.boolean();
const numberSchema = z.number();

export type FileManagerSettingField =
  | 'sortMode'
  | 'clickOnce'
  | 'preferPhysicalSize'
  | 'editorMinimap'
  | 'editorLineOverflow'
  | 'editorFontSize'
  | 'editorEngine'
  | 'vscodeUriScheme'
  | 'imageViewerSmoothing'
  | 'audioPlayerVolume';

const userSettingFields: {
  [K in FileManagerSettingField]: {
    key: string;
    schema: z.ZodType<FileManagerStore[K]>;
    fallback: () => FileManagerStore[K];
  };
} = {
  sortMode: { key: 'file_manager::sorting_mode', schema: serverDirectorySortingModeSchema, fallback: () => 'name_asc' },
  clickOnce: { key: 'file_manager::click_once', schema: booleanSchema, fallback: () => true },
  preferPhysicalSize: { key: 'file_manager::prefer_physical_size', schema: booleanSchema, fallback: () => false },
  editorMinimap: { key: 'file_manager::editor_minimap', schema: booleanSchema, fallback: () => false },
  editorLineOverflow: {
    key: 'file_manager::editor_line_overflow',
    schema: booleanSchema,
    fallback: () => window.matchMedia('(pointer: coarse)').matches,
  },
  editorFontSize: { key: 'file_manager::editor_font_size', schema: numberSchema, fallback: () => 14 },
  editorEngine: {
    key: 'file_manager::editor_engine',
    schema: z.enum(['monaco', 'pierre']),
    fallback: () => (window.matchMedia('(pointer: coarse)').matches ? 'pierre' : 'monaco'),
  },
  vscodeUriScheme: {
    key: 'file_manager::vscode_uri_scheme',
    schema: z.string(),
    fallback: () => 'vscode',
  },
  imageViewerSmoothing: { key: 'file_manager::image_viewer_smoothing', schema: booleanSchema, fallback: () => true },
  audioPlayerVolume: {
    key: 'file_manager::audio_player_volume',
    schema: numberSchema,
    fallback: () => 0.5,
  },
};

export function fileManagerSettingKey(field: FileManagerSettingField): string {
  return userSettingFields[field].key;
}

function readUserSettingField<K extends FileManagerSettingField>(field: K): FileManagerStore[K] {
  const { key, schema, fallback } = userSettingFields[field];
  return getUserSetting(key, schema, fallback());
}

function writeUserSettingField<K extends FileManagerSettingField>(field: K, value: FileManagerStore[K]) {
  const { key } = userSettingFields[field];
  if (DEVICE_ONLY_SETTING_KEYS.has(key)) setUserSettingLocal(key, value);
  else setUserSetting(key, value);
}

export function bridgeFileManagerUserSettings(store: StoreApi<FileManagerStore>): () => void {
  const unsubscribers = (Object.keys(userSettingFields) as FileManagerSettingField[]).map((field) =>
    subscribeUserSetting(userSettingFields[field].key, () => {
      const value = readUserSettingField(field);
      if (!Object.is(store.getState()[field], value)) {
        store.setState({ [field]: value } as Partial<FileManagerStore>);
      }
    }),
  );

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

export const createFileManagerStore = (
  initialExternals: FileManagerExternals,
  initial: { browsingDirectory: string },
) =>
  create<FileManagerStore>()((set, get) => {
    let selectionAnchor: z.infer<typeof serverDirectoryEntrySchema> | null = null;

    return {
      externals: initialExternals,
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
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: () => undefined,
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

      sortMode: readUserSettingField('sortMode'),
      setSortMode: (sortMode) => {
        writeUserSettingField('sortMode', sortMode);
        set({ sortMode });
      },
      clickOnce: readUserSettingField('clickOnce'),
      setClickOnce: (state) => {
        writeUserSettingField('clickOnce', state);
        set({ clickOnce: state });
      },
      preferPhysicalSize: readUserSettingField('preferPhysicalSize'),
      setPreferPhysicalSize: (state) => {
        writeUserSettingField('preferPhysicalSize', state);
        set({ preferPhysicalSize: state });
      },
      editorMinimap: readUserSettingField('editorMinimap'),
      setEditorMinimap: (state) => {
        writeUserSettingField('editorMinimap', state);
        set({ editorMinimap: state });
      },
      editorLineOverflow: readUserSettingField('editorLineOverflow'),
      setEditorLineOverflow: (state) => {
        writeUserSettingField('editorLineOverflow', state);
        set({ editorLineOverflow: state });
      },
      editorFontSize: readUserSettingField('editorFontSize'),
      setEditorFontSize: (size) => {
        writeUserSettingField('editorFontSize', size);
        set({ editorFontSize: size });
      },
      editorEngine: readUserSettingField('editorEngine'),
      setEditorEngine: (engine) => {
        writeUserSettingField('editorEngine', engine);
        set({ editorEngine: engine });
      },
      vscodeUriScheme: readUserSettingField('vscodeUriScheme'),
      setVscodeUriScheme: (scheme) => {
        writeUserSettingField('vscodeUriScheme', scheme);
        set({ vscodeUriScheme: scheme });
      },
      imageViewerSmoothing: readUserSettingField('imageViewerSmoothing'),
      setImageViewerSmoothing: (state) => {
        writeUserSettingField('imageViewerSmoothing', state);
        set({ imageViewerSmoothing: state });
      },
      audioPlayerVolume: readUserSettingField('audioPlayerVolume'),
      setAudioPlayerVolume: (volume) => {
        writeUserSettingField('audioPlayerVolume', volume);
        set({ audioPlayerVolume: volume });
      },
      audioPlayerPlaybackRate: 1,
      setAudioPlayerPlaybackRate: (rate) => {
        set({ audioPlayerPlaybackRate: rate });
      },

      resetEntries: () => {
        const { directoryData } = get().externals;
        if (!directoryData) return;

        set({ browsingEntries: directoryData.entries });
      },
      invalidateFilemanager: () => {
        const { searchInfo, browsingDirectory, sortMode, doSelectFiles, clearActingFiles } = get();
        const { serverUuid, queryClient } = get().externals;

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

        let trimmed = false;
        queryClient.setQueryData<InfiniteData<DirectoryResponse, number>>(
          queryKeys.server(serverUuid).files.directory(browsingDirectory, sortMode),
          (data) => {
            if (!data || data.pages.length <= 1) return data;

            trimmed = true;
            return { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) };
          },
        );

        if (trimmed) window.scrollTo({ top: 0 });

        queryClient
          .invalidateQueries({
            queryKey: queryKeys.server(serverUuid).files.all(),
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
