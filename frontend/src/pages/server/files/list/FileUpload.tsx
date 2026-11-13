import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import UploadDropOverlay from '@/elements/UploadDropOverlay.tsx';
import { freeDiskBytes } from '@/lib/files/diskSpace.ts';
import { registerUploadDiskSpace } from '@/lib/files/uploadManager.ts';
import { useFileDragAndDrop } from '@/pages/server/files/hooks/useFileDragAndDrop.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function FileUpload({ showOverlay = true }: { showOverlay?: boolean }) {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const { uploadFiles, handleFileSelect, handleFolderSelect, browsingWritableDirectory, fileInputRef, folderInputRef } =
    useFileManager(
      useShallow((state) => ({
        uploadFiles: state.fileUploader.uploadFiles,
        handleFileSelect: state.fileUploader.handleFileSelect,
        handleFolderSelect: state.fileUploader.handleFolderSelect,
        browsingWritableDirectory: state.browsingWritableDirectory,
        fileInputRef: state.fileInputRef,
        folderInputRef: state.folderInputRef,
      })),
    );
  const { serverUuid, serverUuidShort, diskLimit, diskBytes, trashBytes } = useServerStore(
    useShallow((state) => ({
      serverUuid: state.server.uuid,
      serverUuidShort: state.server.uuidShort,
      diskLimit: state.server.limits.disk,
      diskBytes: state.stats?.diskBytes ?? null,
      trashBytes: state.stats?.trashBytes ?? 0,
    })),
  );

  const canCreate = useServerCan('files.create');
  const canUpload = browsingWritableDirectory && canCreate;

  useEffect(() => {
    const freeBytes = freeDiskBytes(diskLimit, diskBytes);
    if (freeBytes === null) return;

    return registerUploadDiskSpace(`server:${serverUuid}`, () => ({
      freeBytes,
      openTrash: trashBytes > 0 ? () => navigate(`/server/${serverUuidShort}/files/trash`) : undefined,
    }));
  }, [serverUuid, serverUuidShort, diskLimit, diskBytes, trashBytes, navigate]);

  const { isDragging } = useFileDragAndDrop({
    onDrop: uploadFiles,
    enabled: canUpload,
  });

  return (
    <>
      <input
        ref={fileInputRef}
        type='file'
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e, fileInputRef)}
      />
      <input
        ref={folderInputRef}
        type='file'
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFolderSelect(e, folderInputRef)}
        {...{ webkitdirectory: '', directory: '' }}
      />

      <UploadDropOverlay
        visible={showOverlay && isDragging}
        blocked={!canUpload}
        title={
          canUpload
            ? t('pages.server.files.dropzone.title', {})
            : browsingWritableDirectory
              ? t('pages.server.files.dropzone.noPermission', {})
              : t('pages.server.files.dropzone.readOnly', {})
        }
        subtitle={t(
          canUpload ? 'pages.server.files.dropzone.subtitle' : 'pages.server.files.dropzone.blockedSubtitle',
          {},
        )}
      />
    </>
  );
}
