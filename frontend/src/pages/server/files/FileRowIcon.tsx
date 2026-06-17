import {
  faFile,
  faFileAudio,
  faFilePen,
  faFolder,
  faFolderPlus,
  faFolderTree,
  faImage,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { memo } from 'react';
import { z } from 'zod';
import { isListenableAudio, isOpenableFile, isViewableArchive, isViewableImage } from '@/lib/files.ts';
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
  } else if (isListenableAudio(file)) {
    return faFileAudio;
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
  directory,
}: {
  file?: z.infer<typeof serverDirectoryEntrySchema> | null;
  className?: string;
  directory?: boolean;
}) {
  const isDirectory = directory || file?.directory;

  return (
    <FontAwesomeIcon
      className={classNames(isDirectory ? 'text-yellow-400' : 'text-(--mantine-color-dimmed)', className)}
      icon={file ? getFileIcon(file) : directory ? faFolder : faFile}
    />
  );
}

export default memo(FileRowIcon);
