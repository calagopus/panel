import { FileOpenMode } from 'shared/src/registries/pages/server/files.ts';
import { z } from 'zod';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { FileManagerContextType } from '@/providers/contexts/fileManagerContext.ts';
import { getGlobalStore } from '@/stores/global.ts';

export function isArchiveType(file: z.infer<typeof serverDirectoryEntrySchema>) {
  return (
    [
      'application/vnd.rar', // .rar
      'application/x-rar-compressed', // .rar (2)
      'application/x-tar', // .tar
      'application/x-br', // .tar.br
      'application/x-bzip2', // .tar.bz2, .bz2
      'application/gzip', // .tar.gz, .gz
      'application/x-gzip',
      'application/x-lz4', // .tar.lz4, .lz4
      'application/x-xz', // .tar.xz, .xz
      'application/x-lzip', // .tar.lz, .lz
      'application/zstd', // .tar.zst, .zst
      'application/zip', // .zip
      'application/x-7z-compressed', // .7z
    ].includes(file.mime) || file.name.endsWith('.ddup')
  );
}

export function isViewableArchive(
  file: z.infer<typeof serverDirectoryEntrySchema>,
  fileManagerContext: FileManagerContextType,
) {
  const validExtensions = ['.zip', '.7z', '.ddup'];

  return (
    fileManagerContext.browsingFastDirectory &&
    (['application/zip', 'application/x-7z-compressed'].includes(file.mime) || file.name.endsWith('.ddup')) &&
    validExtensions.some((ext) => file.name.endsWith(ext))
  );
}

export function isViewableImage(file: z.infer<typeof serverDirectoryEntrySchema>) {
  if (file.size > getGlobalStore().settings.server.maxFileManagerViewSize) {
    return false;
  }

  return file.mime.startsWith('image/') && /^image\/(?!svg\+xml)/.test(file.mime);
}

export function isOpenableFile(
  file: z.infer<typeof serverDirectoryEntrySchema>,
  fileManagerContext: FileManagerContextType,
): FileOpenMode {
  if (file.directory || isViewableArchive(file, fileManagerContext)) {
    return {
      openable: true,
      handleOpen: ({ handleDirectoryOpen }) => {
        handleDirectoryOpen(file.name);
      },
    };
  }

  for (const handler of window.extensionContext.extensionRegistry.pages.server.files.fileOpenableHandlers) {
    const result = handler(file, fileManagerContext);
    if (result.openable) {
      return result;
    }
  }

  if (file.size > getGlobalStore().settings.server.maxFileManagerViewSize) {
    return { openable: false };
  }

  if (isViewableImage(file)) {
    return {
      openable: true,
      handleOpen: ({ handleFileOpen }) => {
        handleFileOpen(file.name, 'image', {});
      },
    };
  }

  const matches = [
    'application/jar',
    'application/octet-stream',
    'inode/directory',
    'inode/symlink',
    /^image\/(?!svg\+xml)/,
  ];

  if (isArchiveType(file) && !file.innerEditable) return { openable: false };

  return (file.editable || file.innerEditable) && matches.every((m) => !file.mime.match(m))
    ? {
        openable: true,
        handleOpen: ({ handleFileOpen }) => {
          handleFileOpen(file.name, 'edit', {});
        },
      }
    : { openable: false };
}

export function permissionStringToNumber(mode: string) {
  if (mode.length !== 10) {
    throw new Error('Invalid permission string length.');
  }

  const perms = mode.slice(1);

  const mapping: Record<string, number> = {
    r: 4,
    w: 2,
    x: 1,
    '-': 0,
  };

  let result = '';

  for (let i = 0; i < 9; i += 3) {
    let value = 0;
    for (let j = 0; j < 3; j++) {
      value += mapping[perms[i + j]] || 0;
    }
    result += value.toString();
  }

  return parseInt(result, 10);
}

export function generateArchiveName(extension: string) {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const tzOffset = now.getTimezoneOffset();
  const tzSign = tzOffset <= 0 ? '+' : '-';
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  const tzFormatted = `${tzSign}${tzHours}${tzMinutes}`;

  return `archive-${year}-${month}-${day}T${hours}${minutes}${seconds}${tzFormatted}${extension}`;
}
