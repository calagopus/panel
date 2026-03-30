import { useQueryClient } from '@tanstack/react-query';
import { AxiosRequestConfig } from 'axios';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { axiosInstance, getEmptyPaginationSet } from '@/api/axios.ts';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { useFileUpload } from '@/plugins/useFileUpload.ts';
import { ActingFileMode, DEFAULT_VISIBLE_COLUMNS, FileManagerContext, FileSortColumn, FileSortDirection, ModalType, SearchInfo } from '@/providers/contexts/fileManagerContext.ts';
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
  const [selectedFiles, setSelectedFiles] = useState(
    new ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>('name'),
  );
  const [browsingBackup, setBrowsingBackup] = useState<z.infer<typeof serverBackupSchema> | null>(null);
  const [browsingDirectory, setBrowsingDirectory] = useState('');
  const [browsingEntries, setBrowsingEntries] = useState<Pagination<z.infer<typeof serverDirectoryEntrySchema>>>(
    getEmptyPaginationSet(),
  );
  const [page, setPage] = useState(1);
  const [browsingWritableDirectory, setBrowsingWritableDirectory] = useState(true);
  const [browsingFastDirectory, setBrowsingFastDirectory] = useState(true);
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [modalDirectoryEntries, setModalDirectoryEntries] = useState<z.infer<typeof serverDirectoryEntrySchema>[]>([]);
  const [searchInfo, setSearchInfo] = useState<SearchInfo | null>(null);
  const [sortColumn, setSortColumn] = useState<FileSortColumn | null>(
    (localStorage.getItem('file_sort_column') as FileSortColumn) || null,
  );
  const [sortDirection, setSortDirection] = useState<FileSortDirection>(
    (localStorage.getItem('file_sort_direction') as FileSortDirection) || 'asc',
  );
  const [visibleColumns, setVisibleColumns] = useState<FileSortColumn[]>(() => {
    const stored = localStorage.getItem('file_visible_columns');
    return stored ? JSON.parse(stored) : DEFAULT_VISIBLE_COLUMNS;
  });

  const toggleColumn = (column: FileSortColumn) => {
    setVisibleColumns((prev) => {
      if (column === 'name') return prev; // Name is always visible
      const isRemoving = prev.includes(column);
      if (isRemoving && sortColumn === column) {
        setSortColumn(null);
        setSortDirection('asc');
      }
      return isRemoving ? prev.filter((c) => c !== column) : [...prev, column];
    });
  };

  const [clickOnce, setClickOnce] = useState(localStorage.getItem('file_click_once') !== 'false');
  const [preferPhysicalSize, setPreferPhysicalSize] = useState(
    localStorage.getItem('file_prefer_physical_size') === 'true',
  );
  const [editorMinimap, setEditorMinimap] = useState(localStorage.getItem('file_editor_minimap') === 'true');
  const [editorLineOverflow, setEditorLineOverflow] = useState(
    localStorage.getItem('file_editor_lineoverflow') === 'true',
  );
  const [imageViewerSmoothing, setImageViewerSmoothing] = useState(
    localStorage.getItem('file_image_viewer_smoothing') !== 'false',
  );

  const invalidateFilemanager = () => {
    queryClient
      .invalidateQueries({
        queryKey: ['server', server.uuid, 'files'],
      })
      .catch((e) => console.error(e));
  };

  const doUpload = async (form: FormData, config: AxiosRequestConfig) => {
    const { url } = await getFileUploadUrl(server.uuid, browsingDirectory);
    return axiosInstance.post(url, form, config);
  };

  const fileUploader = useFileUpload(doUpload, invalidateFilemanager);

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
    if (sortColumn) {
      localStorage.setItem('file_sort_column', sortColumn);
    } else {
      localStorage.removeItem('file_sort_column');
    }
  }, [sortColumn]);

  useEffect(() => {
    localStorage.setItem('file_sort_direction', sortDirection);
  }, [sortDirection]);

  useEffect(() => {
    localStorage.setItem('file_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    setBrowsingDirectory(searchParams.get('directory') || '/');
    setPage(Number(searchParams.get('page')) || 1);
  }, [searchParams]);

  useEffect(() => {
    setSelectedFiles(new ObjectSet('name'));
  }, [browsingDirectory]);

  return (
    <FileManagerContext.Provider
      value={{
        fileInputRef,
        folderInputRef,

        actingMode,
        actingFiles,
        actingFilesSource,
        selectedFiles,
        browsingBackup,
        setBrowsingBackup,
        browsingDirectory,
        setBrowsingDirectory,
        browsingEntries,
        setBrowsingEntries,
        page,
        setPage,
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

        visibleColumns,
        setVisibleColumns,
        toggleColumn,

        sortColumn,
        setSortColumn,
        sortDirection,
        setSortDirection,

        clickOnce,
        setClickOnce,
        preferPhysicalSize,
        setPreferPhysicalSize,
        editorMinimap,
        setEditorMinimap,
        editorLineOverflow,
        setEditorLineOverflow,
        imageViewerSmoothing,
        setImageViewerSmoothing,

        invalidateFilemanager,
        fileUploader,
        doActFiles,
        clearActingFiles,
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
