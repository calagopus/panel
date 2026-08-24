import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useStore } from 'zustand';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import getBackup from '@/api/server/backups/getBackup.ts';
import loadDirectory, { DirectoryResponse } from '@/api/server/files/loadDirectory.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { registerUploadRefresh } from '@/lib/uploadManager.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useUploader } from '@/plugins/useUploader.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import {
  bridgeFileManagerUserSettings,
  createFileManagerStore,
  FileManagerStoreContextProvider,
} from '@/stores/fileManager.ts';
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

  const [store] = useState(() =>
    createFileManagerStore(
      {
        serverUuid: server.uuid,
        serverName: server.name,
        routeId: params.id ?? server.uuid,
        queryClient,
        directoryData: null,
      },
      {
        browsingDirectory: searchParams.get('directory') || '/',
      },
    ),
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
    queryKey: queryKeys.server(server.uuid).files.directory(browsingDirectory, sortMode),
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

  const backupUuid = useMemo(() => {
    if (!browsingDirectory.startsWith('/.backups/')) return null;

    const rest = browsingDirectory.slice('/.backups/'.length);
    const slash = rest.indexOf('/');
    return slash === -1 ? rest : rest.slice(0, slash);
  }, [browsingDirectory]);

  const { data: browsingBackup = null, error: browsingBackupError } = useQuery({
    queryKey: queryKeys.server(server.uuid).backups.detail(backupUuid!),
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

  useEffect(() => {
    store.setState({
      externals: {
        serverUuid: server.uuid,
        serverName: server.name,
        routeId: params.id ?? server.uuid,
        queryClient,
        directoryData: data ?? null,
      },
    });
  }, [store, server, params.id, queryClient, data]);

  const getDestination = useCallback((): UploadDestination => {
    const { serverUuid, serverName, routeId } = store.getState().externals;
    return {
      type: 'server',
      serverUuid,
      serverName,
      routeId,
      directory: store.getState().browsingDirectory,
    };
  }, [store]);
  const fileUploader = useUploader(`server:${server.uuid}`, getDestination);

  useEffect(
    () => registerUploadRefresh(`server:${server.uuid}`, () => store.getState().invalidateFilemanager()),
    [server.uuid, store],
  );

  useEffect(() => bridgeFileManagerUserSettings(store), [store]);

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
