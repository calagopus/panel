import { ChangeEvent, RefObject, useCallback, useMemo, useRef } from 'react';
import {
  cancelAllUploads,
  cancelFileUpload,
  cancelFolderUpload,
  getFolderFileCount,
  uploadFiles,
} from '@/lib/uploadManager.ts';
import {
  AggregatedUploadProgress,
  FileUploader,
  UploadDestination,
  UploadItem,
  uploadScopeKey,
  useUploadsStore,
} from '@/stores/uploads.ts';

export function useUploader(scope: string, getDestination: () => UploadDestination): FileUploader {
  const uploads = useUploadsStore((state) => state.uploads);

  const getDestinationRef = useRef(getDestination);
  getDestinationRef.current = getDestination;

  const uploadingFiles = useMemo(() => {
    const map = new Map<string, UploadItem>();
    uploads.forEach((item, key) => {
      if (uploadScopeKey(item.destination) === scope) map.set(key, item);
    });
    return map;
  }, [uploads, scope]);

  const aggregatedUploadProgress = useMemo(() => {
    const map = new Map<string, AggregatedUploadProgress>();

    uploadingFiles.forEach((file) => {
      const parts = file.filePath.split('/');
      if (parts.length < 2) return;

      const folder = parts[0];
      const prev = map.get(folder) ?? {
        totalSize: 0,
        uploadedSize: 0,
        fileCount: getFolderFileCount(scope, folder),
      };

      map.set(folder, {
        ...prev,
        totalSize: prev.totalSize + file.size,
        uploadedSize: prev.uploadedSize + file.uploaded,
        fileCount: prev.fileCount,
      });
    });

    return map;
  }, [uploadingFiles, scope]);

  const totalUploadProgress = useMemo(() => {
    if (uploadingFiles.size === 0) return 0;

    let totalSize = 0;
    let totalUploaded = 0;

    uploadingFiles.forEach((file) => {
      totalSize += file.size;
      totalUploaded += file.uploaded;
    });

    return totalSize === 0 ? 0 : (totalUploaded / totalSize) * 100;
  }, [uploadingFiles]);

  const doUploadFiles = useCallback((files: File[]) => uploadFiles(getDestinationRef.current(), files), []);

  const doCancelFileUpload = useCallback((fileKey: string) => cancelFileUpload(fileKey), []);
  const doCancelFolderUpload = useCallback((folderName: string) => cancelFolderUpload(scope, folderName), [scope]);
  const doCancelAllUploads = useCallback(() => cancelAllUploads(scope), [scope]);

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>, inputRef: RefObject<HTMLInputElement | null>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length > 0) doUploadFiles(files);
      if (inputRef.current) inputRef.current.value = '';
    },
    [doUploadFiles],
  );

  const handleFolderSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>, inputRef: RefObject<HTMLInputElement | null>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length > 0) doUploadFiles(files);
      if (inputRef.current) inputRef.current.value = '';
    },
    [doUploadFiles],
  );

  return useMemo(
    () => ({
      uploadingFiles,
      aggregatedUploadProgress,
      totalUploadProgress,
      uploadFiles: doUploadFiles,
      cancelFileUpload: doCancelFileUpload,
      cancelFolderUpload: doCancelFolderUpload,
      cancelAllUploads: doCancelAllUploads,
      handleFileSelect,
      handleFolderSelect,
    }),
    [
      uploadingFiles,
      aggregatedUploadProgress,
      totalUploadProgress,
      doUploadFiles,
      doCancelFileUpload,
      doCancelFolderUpload,
      doCancelAllUploads,
      handleFileSelect,
      handleFolderSelect,
    ],
  );
}
