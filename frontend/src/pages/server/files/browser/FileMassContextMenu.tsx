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
import ContextMenu, { ContextMenuItem } from '@/elements/ContextMenu.tsx';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import {
  buildDownloadAsMenuItems,
  downloadFilesWithToast,
} from '@/pages/server/files/browser/downloadFilesWithToast.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

interface FileMassContextMenuProps {
  children: (props: { massItems: ContextMenuItem[]; openMassMenu: (x: number, y: number) => void }) => React.ReactNode;
}

const registryProps = {};

export default function FileMassContextMenu({ children }: FileMassContextMenuProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const store = useFileManagerApi();
  const actingMode = useFileManagerStore((state) => state.actingMode);
  const browsingWritableDirectory = useFileManagerStore((state) => state.browsingWritableDirectory);
  const canReadContent = useServerCan('files.read-content');
  const canCreate = useServerCan('files.create');
  const canArchive = useServerCan('files.archive');
  const canUpdate = useServerCan('files.update');
  const canDelete = useServerCan('files.delete');

  const doDownload = useCallback(
    (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
      const { selectedFiles, browsingDirectory } = store.getState();

      downloadFilesWithToast(
        downloadFiles(
          server.uuid,
          browsingDirectory,
          selectedFiles.keys(),
          selectedFiles.size === 1 ? selectedFiles.values()[0].directory : false,
          archiveFormat,
        ),
        { addToast, t },
      );
    },
    [store, server.uuid, t, addToast],
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
        onClick: () => {
          const state = store.getState();
          store.getState().doOpenModal('copy-remote', state.selectedFiles.values());
        },
        color: 'gray',
        canAccess: canReadContent,
      },
      {
        type: 'action',
        icon: faCopy,
        label: t('pages.server.files.button.copy', {}),
        hidden: !!actingMode,
        onClick: () => {
          const state = store.getState();
          state.doActFiles('copy', state.selectedFiles.values());
          state.doSelectFiles([]);
        },
        color: 'gray',
        canAccess: canCreate,
      },
      {
        type: 'action',
        icon: faFileZipper,
        label: t('pages.server.files.button.archive', {}),
        hidden: !!actingMode || !browsingWritableDirectory,
        onClick: () => {
          const state = store.getState();
          state.doOpenModal('archive', state.selectedFiles.values());
        },
        color: 'gray',
        canAccess: canArchive,
      },
      {
        type: 'action',
        icon: faPen,
        label: t('pages.server.files.button.rename', {}),
        hidden: !!actingMode || !browsingWritableDirectory,
        onClick: () => {
          const state = store.getState();
          state.doOpenModal('mass-rename', state.selectedFiles.values());
        },
        color: 'gray',
        canAccess: canUpdate,
      },
      {
        type: 'action',
        icon: faAnglesUp,
        label: t('common.button.move', {}),
        hidden: !!actingMode || !browsingWritableDirectory,
        onClick: () => {
          const state = store.getState();
          state.doActFiles('move', state.selectedFiles.values());
          state.doSelectFiles([]);
        },
        color: 'gray',
        canAccess: canUpdate,
      },
      {
        type: 'action',
        icon: faTrash,
        label: t('common.button.delete', {}),
        hidden: !!actingMode || !browsingWritableDirectory,
        onClick: () => {
          const state = store.getState();
          state.doOpenModal('delete', state.selectedFiles.values());
        },
        color: 'red',
        canAccess: canDelete,
      },
    ],
    [
      t,
      actingMode,
      browsingWritableDirectory,
      canReadContent,
      canCreate,
      canArchive,
      canUpdate,
      canDelete,
      store,
      doDownload,
    ],
  );

  return (
    <ContextMenu
      items={items}
      registry={window.extensionContext.extensionRegistry.pages.server.files.fileMassContextMenu}
      registryProps={registryProps}
    >
      {({ openMenu, items }) => children({ massItems: items, openMassMenu: openMenu })}
    </ContextMenu>
  );
}
