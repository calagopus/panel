import {
  faAnglesUp,
  faClone,
  faCopy,
  faFileArrowDown,
  faFileZipper,
  faPen,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import downloadFiles from '@/api/server/files/downloadFiles.ts';
import ContextMenu, { ContextMenuItem } from '@/elements/ContextMenu.tsx';
import { streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
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
  const canRead = useServerCan('files.read');
  const canCreate = useServerCan('files.create');
  const canArchive = useServerCan('files.archive');
  const canUpdate = useServerCan('files.update');
  const canDelete = useServerCan('files.delete');

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
    const { selectedFiles, browsingDirectory } = store.getState();

    downloadFiles(
      server.uuid,
      browsingDirectory,
      selectedFiles.keys(),
      selectedFiles.size === 1 ? selectedFiles.values()[0].directory : false,
      archiveFormat,
    )
      .then(({ url }) => {
        addToast(t('pages.server.files.toast.downloadStarted', {}), 'success');
        window.open(url);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const items = useMemo<ContextMenuItem[]>(
    () => [
      {
        icon: faFileArrowDown,
        label: t('common.button.download', {}),
        hidden: !!actingMode,
        color: 'gray',
        items: Object.entries(streamingArchiveFormatLabelMapping).map(([mime, label]) => ({
          icon: faFileArrowDown,
          label: t('common.button.downloadAs', { format: label }),
          onClick: () => doDownload(mime as z.infer<typeof streamingArchiveFormat>),
          color: 'gray',
        })),
        canAccess: canReadContent,
      },
      {
        icon: faClone,
        label: t('pages.server.files.button.remoteCopy', {}),
        hidden: !!actingMode,
        onClick: () => {
          const state = store.getState();
          store.getState().doOpenModal('copy-remote', state.selectedFiles.values());
        },
        color: 'gray',
        canAccess: canRead,
      },
      {
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
    [t, actingMode, browsingWritableDirectory, canReadContent, canRead, canCreate, canArchive, canUpdate, canDelete],
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
