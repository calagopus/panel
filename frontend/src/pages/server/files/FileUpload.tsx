import { useShallow } from 'zustand/react/shallow';
import FileUploadOverlay from '@/pages/server/files/FileUploadOverlay.tsx';
import { useFileDragAndDrop } from '@/pages/server/files/hooks/useFileDragAndDrop.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';

export default function FileUpload() {
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

  const { isDragging } = useFileDragAndDrop({
    onDrop: uploadFiles,
    enabled: browsingWritableDirectory,
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

      <FileUploadOverlay visible={isDragging && browsingWritableDirectory} />
    </>
  );
}
