import {
  faAnglesUp,
  faClone,
  faCopy,
  faFileArrowDown,
  faFileZipper,
  faPen,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';
import downloadFiles from '@/api/server/files/downloadFiles.ts';
import ContextMenu, { ContextMenuItem } from '@/elements/overlays/ContextMenu.tsx';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { buildDownloadAsMenuItems, downloadFilesWithToast } from '@/pages/server/files/list/downloadFilesWithToast.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

type FileEntry = z.infer<typeof serverDirectoryEntrySchema>;

interface FileMassContextMenuProps {
  directory?: string;
  files?: FileEntry[];
  writableDirectory?: boolean;
  children: (props: { massItems: ContextMenuItem[]; openMassMenu: (x: number, y: number) => void }) => React.ReactNode;
}

const registryProps = {};

export default function FileMassContextMenu({
  directory,
  files,
  writableDirectory,
  children,
}: FileMassContextMenuProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const store = useFileManagerApi();
  const actingMode = useFileManagerStore((state) => state.actingMode);
  const browsingDirectory = useFileManagerStore((state) => state.browsingDirectory);
  const browsingWritableDirectory = useFileManagerStore((state) => state.browsingWritableDirectory);
  const canReadContent = useServerCan('files.read-content');
  const canCreate = useServerCan('files.create');
  const canArchive = useServerCan('files.archive');
  const canUpdate = useServerCan('files.update');
  const canDelete = useServerCan('files.delete');
  const activeDirectory = directory ?? browsingDirectory;
  const activeWritableDirectory = writableDirectory ?? browsingWritableDirectory;
  const getActiveFiles = useCallback(() => files ?? store.getState().selectedFiles.values(), [files, store]);
  const prepareFileManager = useCallback(() => {
    const state = store.getState();
    state.setBrowsingContext({ directory: activeDirectory, writable: activeWritableDirectory });
    if (files) state.doSelectFiles(files);
  }, [activeDirectory, activeWritableDirectory, files, store]);
  const withActiveFiles = useCallback(
    (callback: (activeFiles: FileEntry[]) => void) => {
      prepareFileManager();
      callback(getActiveFiles());
    },
    [getActiveFiles, prepareFileManager],
  );

  const doDownload = useCallback(
    (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
      withActiveFiles((activeFiles) => {
        downloadFilesWithToast(
          downloadFiles(
            server.uuid,
            activeDirectory,
            activeFiles.map((file) => file.name),
            activeFiles.length === 1 ? activeFiles[0].directory : false,
            archiveFormat,
          ),
          { addToast, t },
        );
      });
    },
    [activeDirectory, addToast, server.uuid, t, withActiveFiles],
  );

  const items = useMemo<ContextMenuItem[]>(
    () => [
      {
        type: 'action',
        icon: faFileArrowDown,
        label: t('common.button.download', {}),
        hidden: !!actingMode,
        color: 'gray',
        items: buildDownloadAsMenuItems(t, doDownload),
        canAccess: canReadContent,
      },
      {
        type: 'action',
        icon: faClone,
        label: t('pages.server.files.button.remoteCopy', {}),
        hidden: !!actingMode,
        onClick: () => withActiveFiles((activeFiles) => store.getState().doOpenModal('copy-remote', activeFiles)),
        color: 'gray',
        canAccess: canReadContent,
      },
      {
        type: 'action',
        icon: faCopy,
        label: t('pages.server.files.button.copy', {}),
        hidden: !!actingMode,
        onClick: () =>
          withActiveFiles((activeFiles) => {
            const state = store.getState();
            state.doActFiles('copy', activeFiles);
            state.doSelectFiles([]);
          }),
        color: 'gray',
        canAccess: canCreate,
      },
      {
        type: 'action',
        icon: faFileZipper,
        label: t('pages.server.files.button.archive', {}),
        hidden: !!actingMode || !activeWritableDirectory,
        onClick: () => withActiveFiles((activeFiles) => store.getState().doOpenModal('archive', activeFiles)),
        color: 'gray',
        canAccess: canArchive,
      },
      {
        type: 'action',
        icon: faPen,
        label: t('pages.server.files.button.rename', {}),
        hidden: !!actingMode || !activeWritableDirectory,
        onClick: () => withActiveFiles((activeFiles) => store.getState().doOpenModal('mass-rename', activeFiles)),
        color: 'gray',
        canAccess: canUpdate,
      },
      {
        type: 'action',
        icon: faAnglesUp,
        label: t('common.button.move', {}),
        hidden: !!actingMode || !activeWritableDirectory,
        onClick: () =>
          withActiveFiles((activeFiles) => {
            const state = store.getState();
            state.doActFiles('move', activeFiles);
            state.doSelectFiles([]);
          }),
        color: 'gray',
        canAccess: canUpdate,
      },
      {
        type: 'action',
        icon: faTrash,
        label: t('common.button.delete', {}),
        hidden: !!actingMode || !activeWritableDirectory,
        onClick: () => withActiveFiles((activeFiles) => store.getState().doOpenModal('delete', activeFiles)),
        color: 'red',
        canAccess: canDelete,
      },
    ],
    [
      t,
      actingMode,
      activeWritableDirectory,
      canReadContent,
      canCreate,
      canArchive,
      canUpdate,
      canDelete,
      store,
      doDownload,
      withActiveFiles,
    ],
  );

  return (
    <ContextMenu
      items={items}
      registry={window.extensionContext.extensionRegistry.pages.server.files.fileMassContextMenu}
      registryProps={registryProps}
    >
      {({ openMenu, items }) =>
        children({
          massItems: items,
          openMassMenu: (x, y) => {
            prepareFileManager();
            openMenu(x, y);
          },
        })
      }
    </ContextMenu>
  );
}
