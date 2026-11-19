import {
  faDatabase,
  faFile,
  faFileAudio,
  faFilePen,
  faFolder,
  faFolderPlus,
  faFolderTree,
  faImage,
} from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import { memo } from 'react';
import { z } from 'zod';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import {
  isListenableAudio,
  isOpenableFile,
  isSqliteDatabase,
  isViewableArchive,
  isViewableImage,
} from '@/lib/files/files.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { FileManagerStore, useFileManagerApi } from '@/stores/fileManager.ts';

function getFileIcon(
  file: z.infer<typeof serverDirectoryEntrySchema>,
  fileManagerContext: FileManagerStore,
  openable?: boolean,
  archive?: boolean,
): IconLike {
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
  } else if (archive ?? isViewableArchive(file, fileManagerContext.browsingFastDirectory)) {
    return faFolderTree;
  } else if (isSqliteDatabase(file)) {
    return faDatabase;
  } else if (openable ?? isOpenableFile(file, fileManagerContext).openable) {
    return faFilePen;
  }

  return faFile;
}

function FileRowIcon({
  file,
  className,
  directory,
  openable,
  archive,
}: {
  file?: z.infer<typeof serverDirectoryEntrySchema> | null;
  className?: string;
  directory?: boolean;
  openable?: boolean;
  archive?: boolean;
}) {
  const { t } = useTranslations();
  const store = useFileManagerApi();
  const isDirectory = directory || file?.directory;
  const iconColor = isDirectory ? 'text-(--mantine-color-yellow-5)' : 'text-(--mantine-color-dimmed)';
  const icon = file ? getFileIcon(file, store.getState(), openable, archive) : directory ? faFolder : faFile;

  if (!file?.virtual) {
    return (
      <Icon
        data-file-manager-icon={isDirectory ? 'folder' : 'file'}
        className={classNames(iconColor, className)}
        icon={icon}
      />
    );
  }

  return (
    <Tooltip label={t('pages.server.files.tooltip.virtual', {})}>
      <span className={classNames('relative inline-flex', className)}>
        <Icon data-file-manager-icon={isDirectory ? 'folder' : 'file'} className={iconColor} icon={icon} />
        <span className='absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-(--mantine-color-blue-5) ring-1 ring-(--mantine-color-body)' />
      </span>
    </Tooltip>
  );
}

export default memo(FileRowIcon);
