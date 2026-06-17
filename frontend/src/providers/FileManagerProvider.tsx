import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosRequestConfig } from 'axios';
import { ReactNode, startTransition, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { axiosInstance, getEmptyPaginationSet } from '@/api/axios.ts';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl.ts';
import loadDirectory from '@/api/server/files/loadDirectory.ts';
import searchFiles from '@/api/server/files/searchFiles.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { serverDirectoryEntrySchema, serverDirectorySortingModeSchema } from '@/lib/schemas/server/files.ts';
import { UploadResult, useFileUpload } from '@/plugins/useFileUpload.ts';
import { ActingFileMode, FileManagerContext, ModalType, SearchInfo } from '@/providers/contexts/fileManagerContext.ts';
import { useServerStore } from '@/stores/server.ts';

const FileManagerProvider = ({ children }: { children: ReactNode }) => {
  const [searchParams, _] = useSearchParams();
  const { server } = useServerStore();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [actingMode, setActingMode] = useState<ActingFileMode | null>(null);
  const [actingFiles, setActingFiles] = useState(
    new ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>('name'),
  );
  const [actingFilesSource, setActingFilesSource] = useState<string | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(
    new ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>('name'),
  );
  const [draggingFilesSource, setDraggingFilesSource] = useState<string | null>(null);
  const [draggingTarget, setDraggingTarget] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState(
    new ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>('name'),
  );
  const [browsingBackup, setBrowsingBackup] = useState<z.infer<typeof serverBackupSchema> | null>(null);
  const [browsingDirectory, setBrowsingDirectory] = useState('');
  const [browsingEntries, setBrowsingEntries] = useState<Pagination<z.infer<typeof serverDirectoryEntrySchema>>>(
    getEmptyPaginationSet(),
  );
  const [page, setPage] = useState(1);
  const [browsingPrimaryFilesystem, setBrowsingPrimaryFilesystem] = useState(true);
  const [browsingWritableDirectory, setBrowsingWritableDirectory] = useState(true);
  const [browsingFastDirectory, setBrowsingFastDirectory] = useState(true);
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [modalDirectoryEntries, setModalDirectoryEntries] = useState<z.infer<typeof serverDirectoryEntrySchema>[]>([]);
  const [searchInfo, setSearchInfo] = useState<SearchInfo | null>(null);
  const [sortMode, setSortMode] = useState<z.infer<typeof serverDirectorySortingModeSchema>>(
    serverDirectorySortingModeSchema.safeParse(localStorage.getItem('file_sorting_mode')).data ?? 'name_asc',
  );
  const [clickOnce, setClickOnce] = useState(localStorage.getItem('file_click_once') !== 'false');
  const [preferPhysicalSize, setPreferPhysicalSize] = useState(
    localStorage.getItem('file_prefer_physical_size') === 'true',
  );
  const [editorMinimap, setEditorMinimap] = useState(localStorage.getItem('file_editor_minimap') === 'true');
  const [editorLineOverflow, setEditorLineOverflow] = useState(
    localStorage.getItem('file_editor_lineoverflow') === 'true',
  );
  const [vscodeUriScheme, setVscodeUriScheme] = useState(localStorage.getItem('file_vscode_uri_scheme') || 'vscode');
  const [imageViewerSmoothing, setImageViewerSmoothing] = useState(
    localStorage.getItem('file_image_viewer_smoothing') !== 'false',
  );
  const [audioPlayerVolume, setAudioPlayerVolume] = useState(
    Number(localStorage.getItem('file_audio_player_volume')) || 0.5,
  );
  const [audioPlayerPlaybackRate, setAudioPlayerPlaybackRate] = useState(
    Number(localStorage.getItem('file_audio_player_playback_rate')) || 1,
  );

  const { data, isLoading } = useQuery({
    queryKey: ['server', server.uuid, 'files', { browsingDirectory, page, sortMode }],
    queryFn: () => loadDirectory(server.uuid, browsingDirectory, page, sortMode),
  });

  useEffect(() => {
    if (!data) return;

    setBrowsingEntries(data.entries);
    setBrowsingPrimaryFilesystem(data.isFilesystemPrimary);
    setBrowsingWritableDirectory(data.isFilesystemWritable);
    setBrowsingFastDirectory(data.isFilesystemFast);
  }, [data]);

  const resetEntries = () => {
    if (!data) return;

    setBrowsingEntries(data.entries);
  };

  const invalidateFilemanager = () => {
    if (searchInfo) {
      searchFiles(server.uuid, { root: browsingDirectory, ...searchInfo.filters }).then((entries) => {
        startTransition(() => {
          setBrowsingEntries({ total: entries.length, page: 1, perPage: entries.length, data: entries });
          doSelectFiles([]);
          clearActingFiles();
        });
      });
      return;
    }

    queryClient
      .invalidateQueries({
        queryKey: ['server', server.uuid, 'files'],
      })
      .catch((e) => console.error(e));
  };

  const doUpload = async (form: FormData, config: AxiosRequestConfig): Promise<UploadResult> => {
    const { url } = await getFileUploadUrl(server.uuid, browsingDirectory);
    const { data } = await axiosInstance.post(url, form, config);

    return { url, continuationToken: data.continuationToken ?? null };
  };

  const doSplitUpload = async (
    form: FormData,
    config: AxiosRequestConfig,
    continuationToken: string,
    prevUrl: string,
  ): Promise<UploadResult> => {
    const { data } = await axiosInstance.post(prevUrl, form, {
      ...config,
      params: { ...config.params, continuation_token: continuationToken },
    });

    return { url: prevUrl, continuationToken: data.continuationToken ?? null };
  };

  const fileUploader = useFileUpload(doUpload, invalidateFilemanager, doSplitUpload);

  const doActFiles = (mode: ActingFileMode | null, files: z.infer<typeof serverDirectoryEntrySchema>[]) => {
    setActingMode(mode);
    setActingFiles(new ObjectSet('name', files));
    setActingFilesSource(browsingDirectory);
  };

  const clearActingFiles = () => {
    setActingMode(null);
    setActingFiles(new ObjectSet('name'));
    setActingFilesSource(null);
  };

  const doDragFiles = (files: z.infer<typeof serverDirectoryEntrySchema>[]) => {
    setDraggingFiles(new ObjectSet('name', files));
    setDraggingFilesSource(browsingDirectory);
    setDraggingTarget(null);
  };

  const clearDraggingFiles = () => {
    setDraggingFiles(new ObjectSet('name'));
    setDraggingFilesSource(null);
    setDraggingTarget(null);
  };

  const doSelectFiles = (files: z.infer<typeof serverDirectoryEntrySchema>[]) =>
    setSelectedFiles(new ObjectSet('name', files));

  const addSelectedFile = (file: z.infer<typeof serverDirectoryEntrySchema>) => {
    setSelectedFiles((prev) => {
      const next = new ObjectSet('name', prev.values());
      next.add(file);
      return next;
    });
  };

  const removeSelectedFile = (file: z.infer<typeof serverDirectoryEntrySchema>) => {
    setSelectedFiles((prev) => {
      const next = new ObjectSet('name', prev.values());
      next.delete(file);
      return next;
    });
  };

  const doOpenModal = (modal: ModalType, entries?: z.infer<typeof serverDirectoryEntrySchema>[]) => {
    setOpenModal(modal);
    if (entries) {
      setModalDirectoryEntries(entries);
    }
  };

  const doCloseModal = () => {
    setOpenModal(null);
    setModalDirectoryEntries([]);
  };

  useEffect(() => {
    setBrowsingDirectory(searchParams.get('directory') || '/');
    setPage(Number(searchParams.get('page')) || 1);
  }, [searchParams]);

  useEffect(() => {
    setSelectedFiles(new ObjectSet('name'));
  }, [browsingDirectory]);

  useEffect(() => {
    localStorage.setItem('file_sorting_mode', sortMode);
  }, [sortMode]);

  useEffect(() => {
    localStorage.setItem('file_click_once', clickOnce.toString());
  }, [clickOnce]);

  useEffect(() => {
    localStorage.setItem('file_prefer_physical_size', preferPhysicalSize.toString());
  }, [preferPhysicalSize]);

  useEffect(() => {
    localStorage.setItem('file_editor_minimap', editorMinimap.toString());
  }, [editorMinimap]);

  useEffect(() => {
    localStorage.setItem('file_editor_lineoverflow', editorLineOverflow.toString());
  }, [editorLineOverflow]);

  useEffect(() => {
    localStorage.setItem('file_vscode_uri_scheme', vscodeUriScheme);
  }, [vscodeUriScheme]);

  useEffect(() => {
    localStorage.setItem('file_image_viewer_smoothing', imageViewerSmoothing.toString());
  }, [imageViewerSmoothing]);

  useEffect(() => {
    localStorage.setItem('file_audio_player_volume', audioPlayerVolume.toString());
  }, [audioPlayerVolume]);

  useEffect(() => {
    localStorage.setItem('file_audio_player_playback_rate', audioPlayerPlaybackRate.toString());
  }, [audioPlayerPlaybackRate]);

  return (
    <FileManagerContext.Provider
      value={{
        isLoading,
        fileInputRef,
        folderInputRef,

        actingMode,
        actingFiles,
        actingFilesSource,
        draggingFiles,
        draggingFilesSource,
        draggingTarget,
        selectedFiles,
        browsingBackup,
        setBrowsingBackup,
        browsingDirectory,
        setBrowsingDirectory,
        browsingEntries,
        setBrowsingEntries,
        page,
        setPage,
        browsingPrimaryFilesystem,
        setBrowsingPrimaryFilesystem,
        browsingWritableDirectory,
        setBrowsingWritableDirectory,
        browsingFastDirectory,
        setBrowsingFastDirectory,
        openModal,
        setOpenModal,
        modalDirectoryEntries,
        setModalDirectoryEntries,
        searchInfo,
        setSearchInfo,

        sortMode,
        setSortMode,
        clickOnce,
        setClickOnce,
        preferPhysicalSize,
        setPreferPhysicalSize,
        editorMinimap,
        setEditorMinimap,
        editorLineOverflow,
        setEditorLineOverflow,
        vscodeUriScheme,
        setVscodeUriScheme,
        imageViewerSmoothing,
        setImageViewerSmoothing,
        audioPlayerVolume,
        setAudioPlayerVolume,
        audioPlayerPlaybackRate,
        setAudioPlayerPlaybackRate,

        resetEntries,
        invalidateFilemanager,
        fileUploader,
        doActFiles,
        clearActingFiles,
        doDragFiles,
        clearDraggingFiles,
        setDraggingTarget,
        doSelectFiles,
        addSelectedFile,
        removeSelectedFile,
        doOpenModal,
        doCloseModal,
      }}
    >
      {children}
    </FileManagerContext.Provider>
  );
};

export { useFileManager } from './contexts/fileManagerContext.ts';
export { FileManagerProvider };
