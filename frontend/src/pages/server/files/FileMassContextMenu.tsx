import {
  faAnglesUp,
  faClone,
  faCopy,
  faFileArrowDown,
  faFileZipper,
  faPen,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import downloadFiles from '@/api/server/files/downloadFiles.ts';
import ContextMenu, { ContextMenuItem } from '@/elements/ContextMenu.tsx';
import { streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

interface FileMassContextMenuProps {
  children: (props: { massItems: ContextMenuItem[]; openMassMenu: (x: number, y: number) => void }) => React.ReactNode;
}

export default function FileMassContextMenu({ children }: FileMassContextMenuProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const {
    actingMode,
    selectedFiles,
    browsingDirectory,
    browsingWritableDirectory,
    doActFiles,
    doSelectFiles,
    doOpenModal,
  } = useFileManager();

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
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

  return (
    <ContextMenu
      items={[
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
          canAccess: useServerCan('files.read-content'),
        },
        {
          icon: faClone,
          label: t('pages.server.files.button.remoteCopy', {}),
          hidden: !!actingMode,
          onClick: () => doOpenModal('copy-remote', selectedFiles.values()),
          color: 'gray',
          canAccess: useServerCan('files.read'),
        },
        {
          icon: faCopy,
          label: t('pages.server.files.button.copy', {}),
          hidden: !!actingMode,
          onClick: () => {
            doActFiles('copy', selectedFiles.values());
            doSelectFiles([]);
          },
          color: 'gray',
          canAccess: useServerCan('files.create'),
        },
        {
          icon: faFileZipper,
          label: t('pages.server.files.button.archive', {}),
          hidden: !!actingMode || !browsingWritableDirectory,
          onClick: () => doOpenModal('archive', selectedFiles.values()),
          color: 'gray',
          canAccess: useServerCan('files.archive'),
        },
        {
          icon: faPen,
          label: t('pages.server.files.button.rename', {}),
          hidden: !!actingMode || !browsingWritableDirectory,
          onClick: () => doOpenModal('mass-rename', selectedFiles.values()),
          color: 'gray',
          canAccess: useServerCan('files.update'),
        },
        {
          icon: faAnglesUp,
          label: t('common.button.move', {}),
          hidden: !!actingMode || !browsingWritableDirectory,
          onClick: () => {
            doActFiles('move', selectedFiles.values());
            doSelectFiles([]);
          },
          color: 'gray',
          canAccess: useServerCan('files.update'),
        },
        {
          icon: faTrash,
          label: t('common.button.delete', {}),
          hidden: !!actingMode || !browsingWritableDirectory,
          onClick: () => doOpenModal('delete', selectedFiles.values()),
          color: 'red',
          canAccess: useServerCan('files.delete'),
        },
      ]}
      registry={window.extensionContext.extensionRegistry.pages.server.files.fileMassContextMenu}
      registryProps={{}}
    >
      {({ openMenu, items }) => children({ massItems: items, openMassMenu: openMenu })}
    </ContextMenu>
  );
}
