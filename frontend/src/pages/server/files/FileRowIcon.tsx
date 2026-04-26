import {
  faFile,
  faFilePen,
  faFolder,
  faFolderPlus,
  faFolderTree,
  faImage,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { memo } from 'react';
import { z } from 'zod';
import { isOpenableFile, isViewableArchive, isViewableImage } from '@/lib/files.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { getFileManager } from '@/providers/contexts/fileManagerContext.ts';

function getFileIcon(file: z.infer<typeof serverDirectoryEntrySchema>): IconDefinition {
  const fileManagerContext = getFileManager();

  for (const handler of window.extensionContext.extensionRegistry.pages.server.files.fileIconHandlers) {
    const icon = handler(file, fileManagerContext);
    if (icon) {
      return icon;
    }
  }

  if (file.directory) {
    if (file.symlink) {
      return faFolderPlus;
    }

    return faFolder;
  }

  if (isViewableImage(file)) {
    return faImage;
  } else if (isViewableArchive(file, fileManagerContext)) {
    return faFolderTree;
  } else if (isOpenableFile(file, fileManagerContext).openable) {
    return faFilePen;
  }

  return faFile;
}

function FileRowIcon({
  file,
  className,
}: {
  file?: z.infer<typeof serverDirectoryEntrySchema> | null;
  className?: string;
}) {
  return <FontAwesomeIcon className={className} icon={file ? getFileIcon(file) : faFile} />;
}

export default memo(FileRowIcon);
