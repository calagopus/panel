import {
  faAnglesUp,
  faArrowUpRightFromSquare,
  faClone,
  faCopy,
  faEnvelopesBulk,
  faFileArrowDown,
  faFileCirclePlus,
  faFilePen,
  faFileShield,
  faFileZipper,
  faFingerprint,
  faFolderPlus,
  faInfoCircle,
  faLink,
  faListDots,
  faPause,
  faPlay,
  faTrash,
  faWindowMaximize,
  faWindowRestore,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { MemoryRouter } from 'react-router';
import { FileOpenMode } from 'shared/src/registries/pages/server/files';
import { z } from 'zod';
import downloadFiles from '@/api/server/files/downloadFiles.ts';
import ContextMenu, { ContextMenuItem } from '@/elements/overlays/ContextMenu.tsx';
import { isTrashEnabled } from '@/lib/domain/server.ts';
import { fileOpenUrl, isArchiveType } from '@/lib/files/files.ts';
import {
  cancelFileUpload,
  canResumeInSession,
  pauseUpload,
  resumeDetachedUpload,
  resumeUpload,
} from '@/lib/files/uploadManager.ts';
import { openPopup, openUrl } from '@/lib/network/url.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { FileUploadState } from '@/pages/server/files/hooks/useFileUpload.ts';
import { buildDownloadAsMenuItems, downloadFilesWithToast } from '@/pages/server/files/list/downloadFilesWithToast.ts';
import { isMountGateway } from '@/pages/server/files/list/mountGateway.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/contexts/toastContext.ts';
import { useWindows } from '@/providers/contexts/windowContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import RouterRoutes from '@/RouterRoutes.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

const finePointer = matchMedia('(pointer: fine)');

function pickFileToResume(key: string): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.addEventListener(
    'change',
    () => {
      const file = input.files?.[0];
      if (file) resumeDetachedUpload(key, file);
    },
    { once: true },
  );
  input.click();
}

interface FileRowContextMenuProps {
  file: z.infer<typeof serverDirectoryEntrySchema>;
  openMode: FileOpenMode;
  onOpen: () => void;
  directory?: string;
  writableDirectory?: boolean;
  upload?: FileUploadState;
  surface?: 'table' | 'tree';
  onCreateFile?: () => void;
  onCreateDirectory?: () => void;
  children: (props: { items: ContextMenuItem[]; openMenu: (x: number, y: number) => void }) => React.ReactNode;
}

export default function FileRowContextMenu({
  file,
  openMode,
  onOpen,
  directory,
  writableDirectory,
  upload,
  surface = 'table',
  onCreateFile,
  onCreateDirectory,
  children,
}: FileRowContextMenuProps) {
  const { t } = useTranslations();
  const { addToast, addPendingToast } = useToast();
  const { addWindow } = useWindows();
  const server = useServerStore((state) => state.server);
  const store = useFileManagerApi();
  const browsingDirectory = useFileManagerStore((state) => state.browsingDirectory);
  const browsingWritableDirectory = useFileManagerStore((state) => state.browsingWritableDirectory);
  const canReadContent = useServerCan('files.read-content');
  const canCreate = useServerCan('files.create');
  const canUpdate = useServerCan('files.update');
  const canArchive = useServerCan('files.archive');
  const canDelete = useServerCan('files.delete');
  const browsingPrimaryFilesystem = useFileManagerStore((state) => state.browsingPrimaryFilesystem);
  const trashEnabled = isTrashEnabled(server, browsingPrimaryFilesystem);
  const mountGateway = isMountGateway(file, browsingPrimaryFilesystem);
  const activeDirectory = directory ?? browsingDirectory;
  const activeWritableDirectory = writableDirectory ?? browsingWritableDirectory;
  const local = upload?.local ?? null;

  const prepareFileManager = () => {
    store.getState().setBrowsingContext({ directory: activeDirectory, writable: activeWritableDirectory });
  };

  const openModal = (modal: Parameters<ReturnType<typeof store.getState>['doOpenModal']>[0]) => {
    prepareFileManager();
    store.getState().doOpenModal(modal, [file]);
  };

  const buildOpenUrl = () => {
    prepareFileManager();

    return fileOpenUrl(openMode, server, {
      ...store.getState(),
      browsingDirectory: activeDirectory,
      browsingWritableDirectory: activeWritableDirectory,
    });
  };

  const openInNewTab = () => {
    const url = buildOpenUrl();
    if (url) openUrl(url);
  };

  const openInPopup = () => {
    const url = buildOpenUrl();
    if (url) openPopup(url);
  };

  const openInVirtualWindow = () => {
    const url = buildOpenUrl();
    if (!url) return;

    addWindow(
      file.name,
      <MemoryRouter initialEntries={[url]}>
        <RouterRoutes isNormal={false} />
      </MemoryRouter>,
    );
  };

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
    prepareFileManager();
    return downloadFilesWithToast(
      downloadFiles(server.uuid, activeDirectory, [file.name], file.directory, archiveFormat),
      { addToast, addPendingToast, t },
    );
  };

  return (
    <ContextMenu
      items={[
        {
          type: 'action',
          icon: faPause,
          label: t('elements.fileUpload.pause', {}),
          hidden: !local || !local.resumable || local.status !== 'uploading',
          onClick: () => local && pauseUpload(local.key),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faPlay,
          label: t('elements.fileUpload.resume', {}),
          hidden: !local || local.status !== 'paused' || !canResumeInSession(local.key),
          onClick: () => local && resumeUpload(local.key),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faPlay,
          label: t('elements.fileUpload.reselect', {}),
          hidden: !local || local.status !== 'paused' || canResumeInSession(local.key),
          onClick: () => local && pickFileToResume(local.key),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faXmark,
          label: t('elements.fileUpload.cancel', {}),
          hidden: !local,
          onClick: () => local && cancelFileUpload(local.key),
          color: 'red',
          canAccess: canCreate,
        },
        {
          type: 'divider',
          hidden: !local,
        },
        finePointer.matches
          ? {
              type: 'action',
              icon: faArrowUpRightFromSquare,
              label: t('pages.server.files.button.open', {}),
              hidden: !openMode.openable || !!upload,
              onClick: onOpen,
              items: [
                {
                  type: 'action',
                  icon: faWindowRestore,
                  label: t('pages.server.files.button.openInVirtualWindow', {}),
                  onClick: openInVirtualWindow,
                },
                {
                  type: 'action',
                  icon: faWindowMaximize,
                  label: t('pages.server.files.button.openInPopup', {}),
                  onClick: openInPopup,
                },
                {
                  type: 'action',
                  icon: faArrowUpRightFromSquare,
                  label: t('pages.server.files.button.openInNewTab', {}),
                  onClick: openInNewTab,
                },
              ],
              canAccess: canReadContent,
            }
          : {
              type: 'action',
              icon: faArrowUpRightFromSquare,
              label: t('pages.server.files.button.openInNewTab', {}),
              hidden: !openMode.openable || !!upload,
              onClick: openInNewTab,
              canAccess: canReadContent,
            },
        {
          type: 'action',
          icon: faFileCirclePlus,
          label: t('pages.server.files.quickAction.newFile', {}),
          hidden: !onCreateFile || !!upload,
          onClick: onCreateFile,
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faFolderPlus,
          label: t('pages.server.files.quickAction.newDirectory', {}),
          hidden: !onCreateDirectory || !!upload,
          onClick: onCreateDirectory,
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'divider',
          hidden: (!onCreateFile && !onCreateDirectory) || !!upload,
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faFilePen,
          label: t('pages.server.files.button.rename', {}),
          hidden: !activeWritableDirectory || !!upload || mountGateway,
          onClick: () => openModal('rename'),
          canAccess: canUpdate,
        },
        {
          type: 'action',
          icon: faCopy,
          label: t('pages.server.files.button.copy', {}),
          hidden: (!file.file && !file.directory) || !!upload,
          onClick: () => openModal('copy'),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faLink,
          label: t('pages.server.files.button.symlink', {}),
          hidden: !activeWritableDirectory || !!upload,
          onClick: () => openModal('nameSymlink'),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faClone,
          label: t('pages.server.files.button.remoteCopy', {}),
          hidden: (!file.file && !file.directory) || !!upload,
          onClick: () => openModal('copy-remote'),
          color: 'gray',
          canAccess: canReadContent,
        },
        {
          type: 'action',
          icon: faAnglesUp,
          label: t('common.button.move', {}),
          hidden: !activeWritableDirectory || !!upload || mountGateway,
          onClick: () => {
            prepareFileManager();
            store.getState().doActFiles('move', [file]);
          },
          color: 'gray',
          canAccess: canUpdate,
        },
        isArchiveType(file)
          ? {
              type: 'action',
              icon: faEnvelopesBulk,
              label: t('pages.server.files.button.extract', {}),
              hidden: !activeWritableDirectory || !!upload,
              onClick: () => openModal('extract'),
              color: 'gray',
              canAccess: canArchive,
            }
          : {
              type: 'action',
              icon: faFileZipper,
              label: t('pages.server.files.button.archive', {}),
              hidden: !activeWritableDirectory || !!upload,
              onClick: () => openModal('archive'),
              color: 'gray',
              canAccess: canArchive,
            },
        {
          type: 'divider',
          hidden: !!upload,
        },
        {
          type: 'action',
          icon: faFileArrowDown,
          label: t('common.button.download', {}),
          hidden: !!upload,
          onClick: file.file ? () => doDownload('tar_gz') : undefined,
          color: 'gray',
          items: file.directory ? buildDownloadAsMenuItems(t, doDownload) : [],
          canAccess: canReadContent,
        },
        {
          type: 'action',
          icon: faListDots,
          label: t('pages.server.files.button.more', {}),
          color: 'gray',
          items: [
            {
              type: 'action',
              icon: faInfoCircle,
              label: t('common.button.details', {}),
              onClick: () => openModal('details'),
              color: 'gray',
            },
            {
              type: 'action',
              icon: faFingerprint,
              label: t('pages.server.files.button.fingerprint', {}),
              hidden: !file.file || !!upload,
              onClick: () => openModal('fingerprint'),
              color: 'gray',
              canAccess: canReadContent,
            },
            {
              type: 'action',
              icon: faFileShield,
              label: t('pages.server.files.button.permissions', {}),
              hidden: !!upload,
              onClick: () => openModal('permissions'),
              color: 'gray',
              canAccess: canUpdate,
            },
          ],
        },
        {
          type: 'action',
          icon: faTrash,
          label: t(trashEnabled ? 'pages.server.files.button.moveToTrash' : 'common.button.delete', {}),
          hidden: !activeWritableDirectory || !!local || mountGateway,
          onClick: () => openModal('delete'),
          color: trashEnabled ? 'gray' : 'red',
          canAccess: canDelete,
        },
      ]}
      registry={window.extensionContext.extensionRegistry.pages.server.files.fileContextMenu}
      registryProps={{ file, directory: activeDirectory, surface }}
    >
      {children}
    </ContextMenu>
  );
}
