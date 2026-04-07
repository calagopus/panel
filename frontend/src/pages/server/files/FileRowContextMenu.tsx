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
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import RouterRoutes from '@/RouterRoutes.tsx';
import { useServerStore } from '@/stores/server.ts';

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
  const fileManagerContext = useFileManager();
  const canCreate = useServerCan('files.create');
  const canArchive = useServerCan('files.archive');

  const { browsingDirectory, browsingWritableDirectory, doOpenModal, doActFiles } = fileManagerContext;

  const doUnarchive = () => {
    decompressFile(server.uuid, browsingDirectory, file.name).catch((msg) => {
      addToast(httpErrorToHuman(msg), 'error');
    });
  };

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
    downloadFiles(server.uuid, browsingDirectory, [file.name], file.directory, archiveFormat)
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
          hidden: !matchMedia('(pointer: fine)').matches || !openMode.openable,
          onClick: () => {
            if (!openMode.openable) return;

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
          canAccess: useServerCan('files.read-content'),
        },
        {
          icon: faFilePen,
          label: t('pages.server.files.button.rename', {}),
          hidden: !browsingWritableDirectory,
          onClick: () => doOpenModal('rename', [file]),
          canAccess: useServerCan('files.update'),
        },
        {
          icon: faCopy,
          label: t('pages.server.files.button.copy', {}),
          hidden: !browsingWritableDirectory || (!file.file && !file.directory),
          onClick: () => doOpenModal('copy', [file]),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          icon: faAnglesUp,
          label: t('pages.server.files.button.move', {}),
          hidden: !browsingWritableDirectory,
          onClick: () => doActFiles('move', [file]),
          color: 'gray',
          canAccess: useServerCan('files.update'),
        },
        isArchiveType(file)
          ? {
              icon: faEnvelopesBulk,
              label: t('pages.server.files.button.unarchive', {}),
              hidden: !browsingWritableDirectory,
              onClick: doUnarchive,
              color: 'gray',
              canAccess: canCreate,
            }
          : {
              icon: faFileZipper,
              label: t('pages.server.files.button.archive', {}),
              hidden: !browsingWritableDirectory,
              onClick: () => doOpenModal('archive', [file]),
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
          canAccess: useServerCan('files.read-content'),
        },
        {
          icon: faListDots,
          label: t('pages.server.files.button.more', {}),
          color: 'gray',
          items: [
            {
              icon: faInfoCircle,
              label: t('pages.server.files.button.details', {}),
              onClick: () => doOpenModal('details', [file]),
              color: 'gray',
            },
            {
              icon: faFingerprint,
              label: t('pages.server.files.button.fingerprint', {}),
              hidden: !file.file,
              onClick: () => doOpenModal('fingerprint', [file]),
              color: 'gray',
              canAccess: useServerCan('files.read-content'),
            },
            {
              icon: faFileShield,
              label: t('pages.server.files.button.permissions', {}),
              onClick: () => doOpenModal('permissions', [file]),
              color: 'gray',
              canAccess: useServerCan('files.update'),
            },
          ],
        },
        {
          icon: faTrash,
          label: t('common.button.delete', {}),
          hidden: !browsingWritableDirectory,
          onClick: () => doOpenModal('delete', [file]),
          color: 'red',
          canAccess: useServerCan('files.delete'),
        },
      ]}
      registry={window.extensionContext.extensionRegistry.pages.server.files.fileContextMenu}
      registryProps={{ file }}
    >
      {children}
    </ContextMenu>
  );
}
