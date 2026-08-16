import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useStore } from 'zustand';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import getBackup from '@/api/server/backups/getBackup.ts';
import loadDirectory, { DirectoryResponse } from '@/api/server/files/loadDirectory.ts';
import { registerUploadRefresh } from '@/lib/uploadManager.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useUploader } from '@/plugins/useUploader.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { createFileManagerStore, FileManagerExternals, FileManagerStoreContextProvider } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';
import { UploadDestination } from '@/stores/uploads.ts';

const FileManagerProvider = ({ children }: { children: ReactNode }) => {
  const [searchParams, _] = useSearchParams();
  const params = useParams<'id'>();
  const server = useServerStore((state) => state.server);
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const canReadFiles = useServerCan('files.read');
  const canReadBackups = useServerCan('backups.read');

  const externalsRef = useRef<FileManagerExternals>({ serverUuid: server.uuid, queryClient, directoryData: null });
  const [store] = useState(() =>
    createFileManagerStore(() => externalsRef.current, {
      browsingDirectory: searchParams.get('directory') || '/',
    }),
  );

  const browsingDirectory = useStore(store, (state) => state.browsingDirectory);
  const sortMode = useStore(store, (state) => state.sortMode);

  const {
    data: infiniteData,
    error: directoryError,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['server', server.uuid, 'files', { browsingDirectory, sortMode }],
    queryFn: ({ pageParam }) => loadDirectory(server.uuid, browsingDirectory, pageParam, sortMode),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.entries.data.length, 0);
      return loaded < lastPage.entries.total ? allPages.length + 1 : undefined;
    },
    enabled: canReadFiles,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const data = useMemo<DirectoryResponse | null>(() => {
    if (!infiniteData || infiniteData.pages.length === 0) return null;

    const [firstPage] = infiniteData.pages;
    const entries = infiniteData.pages.flatMap((p) => p.entries.data);

    return {
      isFilesystemPrimary: firstPage.isFilesystemPrimary,
      isFilesystemWritable: firstPage.isFilesystemWritable,
      isFilesystemFast: firstPage.isFilesystemFast,
      entries: {
        total: firstPage.entries.total,
        perPage: firstPage.entries.perPage,
        page: infiniteData.pages.length,
        data: entries,
      },
    };
  }, [infiniteData]);

  externalsRef.current = { serverUuid: server.uuid, queryClient, directoryData: data ?? null };

  const backupUuid = useMemo(() => {
    if (!browsingDirectory.startsWith('/.backups/')) return null;

    const rest = browsingDirectory.slice('/.backups/'.length);
    const slash = rest.indexOf('/');
    return slash === -1 ? rest : rest.slice(0, slash);
  }, [browsingDirectory]);

  const { data: browsingBackup = null, error: browsingBackupError } = useQuery({
    queryKey: ['server', server.uuid, 'backup', backupUuid],
    queryFn: () => getBackup(server.uuid, backupUuid!),
    enabled: !!backupUuid && canReadBackups,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (browsingBackupError) {
      addToast(httpErrorToHuman(browsingBackupError), 'error');
    }
  }, [browsingBackupError]);

  useEffect(() => {
    if (directoryError) {
      addToast(httpErrorToHuman(directoryError), 'error');
    }
  }, [directoryError]);

  const serverRef = useRef(server);
  serverRef.current = server;
  const routeIdRef = useRef(params.id);
  routeIdRef.current = params.id;

  const getDestination = useCallback(
    (): UploadDestination => ({
      type: 'server',
      serverUuid: externalsRef.current.serverUuid,
      serverName: serverRef.current.name,
      routeId: routeIdRef.current ?? externalsRef.current.serverUuid,
      directory: store.getState().browsingDirectory,
    }),
    [store],
  );
  const fileUploader = useUploader(`server:${server.uuid}`, getDestination);

  useEffect(
    () => registerUploadRefresh(`server:${server.uuid}`, () => store.getState().invalidateFilemanager()),
    [server.uuid, store],
  );

  useEffect(() => {
    store.setState({ isLoading: isFetching && !isFetchingNextPage });
  }, [isFetching, isFetchingNextPage]);

  useEffect(() => {
    store.setState({
      hasNextPage: !!hasNextPage,
      isFetchingNextPage,
      fetchNextPage: () => {
        fetchNextPage().catch((e) => console.error(e));
      },
    });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    store.setState({ fileUploader });
  }, [fileUploader]);

  useEffect(() => {
    store.setState({ browsingBackup });
  }, [browsingBackup]);

  useEffect(() => {
    if (store.getState().searchInfo) return;

    if (!data) {
      if (directoryError) {
        store.setState({
          browsingEntries: getEmptyPaginationSet(),
          browsingError: httpErrorToHuman(directoryError),
        });
      }
      return;
    }

    store.setState({
      browsingEntries: data.entries,
      browsingError: null,
      browsingPrimaryFilesystem: data.isFilesystemPrimary,
      browsingWritableDirectory: data.isFilesystemWritable,
      browsingFastDirectory: data.isFilesystemFast,
    });
  }, [data, directoryError, store]);

  useEffect(() => {
    store.getState().setBrowsingDirectory(searchParams.get('directory') || '/');
  }, [searchParams]);

  return <FileManagerStoreContextProvider createStore={() => store}>{children}</FileManagerStoreContextProvider>;
};

export { useFileManager } from '@/stores/fileManager.ts';
export { FileManagerProvider };
