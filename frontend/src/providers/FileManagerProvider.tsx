import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosRequestConfig } from 'axios';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useStore } from 'zustand';
import { axiosInstance, getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import getBackup from '@/api/server/backups/getBackup.ts';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl.ts';
import loadDirectory from '@/api/server/files/loadDirectory.ts';
import { UploadResult, useFileUpload } from '@/plugins/useFileUpload.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { createFileManagerStore, FileManagerExternals, FileManagerStoreContextProvider } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

const FileManagerProvider = ({ children }: { children: ReactNode }) => {
  const [searchParams, _] = useSearchParams();
  const server = useServerStore((state) => state.server);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const externalsRef = useRef<FileManagerExternals>({ serverUuid: server.uuid, queryClient, directoryData: null });
  const [store] = useState(() =>
    createFileManagerStore(() => externalsRef.current, {
      browsingDirectory: searchParams.get('directory') || '/',
      page: Number(searchParams.get('page')) || 1,
    }),
  );

  const browsingDirectory = useStore(store, (state) => state.browsingDirectory);
  const page = useStore(store, (state) => state.page);
  const sortMode = useStore(store, (state) => state.sortMode);

  const {
    data,
    error: directoryError,
    isFetching,
  } = useQuery({
    queryKey: ['server', server.uuid, 'files', { browsingDirectory, page, sortMode }],
    queryFn: () => loadDirectory(server.uuid, browsingDirectory, page, sortMode),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

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
    enabled: !!backupUuid,
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

  const doUpload = useCallback(
    async (form: FormData, config: AxiosRequestConfig, target?: string): Promise<UploadResult> => {
      const { url } = await getFileUploadUrl(
        externalsRef.current.serverUuid,
        target ?? store.getState().browsingDirectory,
      );
      const { data } = await axiosInstance.post(url, form, config);

      return { url, continuationToken: data.continuationToken ?? null };
    },
    [store],
  );

  const doSplitUpload = useCallback(
    async (
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
    },
    [],
  );

  const onUploadComplete = useCallback(() => store.getState().invalidateFilemanager(), [store]);
  const getUploadTarget = useCallback(() => store.getState().browsingDirectory, [store]);
  const fileUploader = useFileUpload(doUpload, onUploadComplete, doSplitUpload, getUploadTarget);

  useEffect(() => {
    store.setState({ isLoading: isFetching });
  }, [isFetching]);

  useEffect(() => {
    store.setState({ fileUploader });
  }, [fileUploader]);

  useEffect(() => {
    store.setState({ browsingBackup });
  }, [browsingBackup]);

  useEffect(() => {
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
  }, [data, directoryError]);

  useEffect(() => {
    const state = store.getState();
    state.setBrowsingDirectory(searchParams.get('directory') || '/');
    state.setPage(Number(searchParams.get('page')) || 1);
  }, [searchParams]);

  return <FileManagerStoreContextProvider createStore={() => store}>{children}</FileManagerStoreContextProvider>;
};

export { useFileManager } from '@/stores/fileManager.ts';
export { FileManagerProvider };
