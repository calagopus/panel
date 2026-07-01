import {
  faAnglesUp,
  faCopy,
  faEnvelopesBulk,
  faFileArrowDown,
  faFilePen,
  faFileShield,
  faFileZipper,
  faFingerprint,
  faInfoCircle,
  faListDots,
  faTrash,
  faWindowRestore,
} from '@fortawesome/free-solid-svg-icons';
import { join } from 'pathe';
import { createSearchParams, MemoryRouter } from 'react-router';
import { FileOpenMode } from 'shared/src/registries/pages/server/files';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import decompressFile from '@/api/server/files/decompressFile.ts';
import downloadFiles from '@/api/server/files/downloadFiles.ts';
import ContextMenu, { ContextMenuItem } from '@/elements/ContextMenu.tsx';
import { streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { isArchiveType } from '@/lib/files.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/contexts/toastContext.ts';
import { useWindows } from '@/providers/contexts/windowContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import RouterRoutes from '@/RouterRoutes.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

const finePointer = matchMedia('(pointer: fine)');

interface FileRowContextMenuProps {
  file: z.infer<typeof serverDirectoryEntrySchema>;
  openMode: FileOpenMode;
  children: (props: { items: ContextMenuItem[]; openMenu: (x: number, y: number) => void }) => React.ReactNode;
}

export default function FileRowContextMenu({ file, openMode, children }: FileRowContextMenuProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { addWindow } = useWindows();
  const { server } = useServerStore();
  const store = useFileManagerApi();
  const browsingWritableDirectory = useFileManagerStore((state) => state.browsingWritableDirectory);
  const canReadContent = useServerCan('files.read-content');
  const canCreate = useServerCan('files.create');
  const canUpdate = useServerCan('files.update');
  const canArchive = useServerCan('files.archive');
  const canDelete = useServerCan('files.delete');

  const doUnarchive = () => {
    decompressFile(server.uuid, store.getState().browsingDirectory, file.name).catch((msg) => {
      addToast(httpErrorToHuman(msg), 'error');
    });
  };

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
    downloadFiles(server.uuid, store.getState().browsingDirectory, [file.name], file.directory, archiveFormat)
      .then(({ url }) => {
        addToast(t('pages.server.files.toast.downloadStarted', {}), 'success');
        window.open(url);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <ContextMenu
      items={[
        {
          icon: faWindowRestore,
          label: t('pages.server.files.button.openInNewWindow', {}),
          hidden: !finePointer.matches || !openMode.openable,
          onClick: () => {
            if (!openMode.openable) return;

            const fileManagerContext = store.getState();

            let url = new URL(window.location.href);
            openMode.handleOpen({
              fileManagerContext,
              server,
              setSearchParams(params) {
                url.search = createSearchParams(
                  typeof params === 'function' ? params(new URLSearchParams(url.search)) : params,
                ).toString();
              },
              navigate(path) {
                if (typeof path !== 'string') return;

                url = new URL(path, url);
              },
              handleDirectoryOpen(path) {
                url.search = createSearchParams({
                  directory: join(fileManagerContext.browsingDirectory, path),
                }).toString();
              },
              handleFileOpen(file, action, params) {
                const searchParams = createSearchParams({
                  directory: fileManagerContext.browsingDirectory,
                  file,
                  ...params,
                });

                url = new URL(`/server/${server.uuidShort}/files/${action}?${searchParams}`, window.location.origin);
              },
            });

            addWindow(
              file.name,
              <MemoryRouter initialEntries={[url.pathname + url.search]}>
                <RouterRoutes isNormal={false} />
              </MemoryRouter>,
            );
          },
          canAccess: canReadContent,
        },
        {
          icon: faFilePen,
          label: t('pages.server.files.button.rename', {}),
          hidden: !browsingWritableDirectory,
          onClick: () => store.getState().doOpenModal('rename', [file]),
          canAccess: canUpdate,
        },
        {
          icon: faCopy,
          label: t('pages.server.files.button.copy', {}),
          hidden: !browsingWritableDirectory || (!file.file && !file.directory),
          onClick: () => store.getState().doOpenModal('copy', [file]),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          icon: faAnglesUp,
          label: t('common.button.move', {}),
          hidden: !browsingWritableDirectory,
          onClick: () => store.getState().doActFiles('move', [file]),
          color: 'gray',
          canAccess: canUpdate,
        },
        isArchiveType(file)
          ? {
              icon: faEnvelopesBulk,
              label: t('pages.server.files.button.unarchive', {}),
              hidden: !browsingWritableDirectory,
              onClick: doUnarchive,
              color: 'gray',
              canAccess: canArchive,
            }
          : {
              icon: faFileZipper,
              label: t('pages.server.files.button.archive', {}),
              hidden: !browsingWritableDirectory,
              onClick: () => store.getState().doOpenModal('archive', [file]),
              color: 'gray',
              canAccess: canArchive,
            },
        {
          icon: faFileArrowDown,
          label: t('common.button.download', {}),
          onClick: file.file ? () => doDownload('tar_gz') : undefined,
          color: 'gray',
          items: file.directory
            ? Object.entries(streamingArchiveFormatLabelMapping).map(([mime, label]) => ({
                icon: faFileArrowDown,
                label: t('common.button.downloadAs', { format: label }),
                onClick: () => doDownload(mime as z.infer<typeof streamingArchiveFormat>),
                color: 'gray',
              }))
            : [],
          canAccess: canReadContent,
        },
        {
          icon: faListDots,
          label: t('pages.server.files.button.more', {}),
          color: 'gray',
          items: [
            {
              icon: faInfoCircle,
              label: t('common.button.details', {}),
              onClick: () => store.getState().doOpenModal('details', [file]),
              color: 'gray',
            },
            {
              icon: faFingerprint,
              label: t('pages.server.files.button.fingerprint', {}),
              hidden: !file.file,
              onClick: () => store.getState().doOpenModal('fingerprint', [file]),
              color: 'gray',
              canAccess: canReadContent,
            },
            {
              icon: faFileShield,
              label: t('pages.server.files.button.permissions', {}),
              onClick: () => store.getState().doOpenModal('permissions', [file]),
              color: 'gray',
              canAccess: canUpdate,
            },
          ],
        },
        {
          icon: faTrash,
          label: t('common.button.delete', {}),
          hidden: !browsingWritableDirectory,
          onClick: () => store.getState().doOpenModal('delete', [file]),
          color: 'red',
          canAccess: canDelete,
        },
      ]}
      registry={window.extensionContext.extensionRegistry.pages.server.files.fileContextMenu}
      registryProps={{ file }}
    >
      {children}
    </ContextMenu>
  );
}
