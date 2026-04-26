import FileUploadOverlay from '@/pages/server/files/FileUploadOverlay.tsx';
import { useFileDragAndDrop } from '@/pages/server/files/hooks/useFileDragAndDrop.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';

export default function FileUpload() {
  const { fileUploader, browsingWritableDirectory, fileInputRef, folderInputRef } = useFileManager();
  const { uploadFiles, handleFileSelect, handleFolderSelect } = fileUploader;

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
