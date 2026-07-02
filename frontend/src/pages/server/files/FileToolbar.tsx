import {
  faChevronDown,
  faDownload,
  faFileCirclePlus,
  faFileUpload,
  faFolderOpen,
  faFolderPlus,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createSearchParams, useNavigate } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ContextMenu from '@/elements/ContextMenu.tsx';
import Group from '@/elements/Group.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import FileConnectButton from './FileConnectButton.tsx';

export default function FileToolbar() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const server = useServerStore((state) => state.server);
  const { fileInputRef, folderInputRef, browsingDirectory, browsingWritableDirectory, doOpenModal } = useFileManager(
    useShallow((state) => ({
      fileInputRef: state.fileInputRef,
      folderInputRef: state.folderInputRef,
      browsingDirectory: state.browsingDirectory,
      browsingWritableDirectory: state.browsingWritableDirectory,
      doOpenModal: state.doOpenModal,
    })),
  );

  return (
    <Group>
      {window.extensionContext.extensionRegistry.pages.server.files.fileToolbar.prependedComponents.map(
        (Component, i) => (
          <Component key={`files-fileToolbar-prepended-${i}`} />
        ),
      )}
      <FileConnectButton />
      {browsingWritableDirectory && (
        <ServerCan action='files.create'>
          <ContextMenu
            items={[
              {
                icon: faFileCirclePlus,
                label: t('pages.server.files.button.fileFromEditor', {}),
                onClick: () =>
                  navigate(
                    `/server/${server.uuidShort}/files/new?${createSearchParams({ directory: browsingDirectory })}`,
                  ),
                color: 'gray',
              },
              {
                icon: faFolderPlus,
                label: t('pages.server.files.button.directory', {}),
                onClick: () => doOpenModal('nameDirectory'),
                color: 'gray',
              },
              {
                icon: faDownload,
                label: t('pages.server.files.button.fileFromPull', {}),
                onClick: () => doOpenModal('pullFile'),
                color: 'gray',
              },
              {
                icon: faFileUpload,
                label: t('pages.server.files.button.fileFromUpload', {}),
                onClick: () => fileInputRef.current?.click(),
                color: 'gray',
              },
              {
                icon: faFolderOpen,
                label: t('pages.server.files.button.directoryFromUpload', {}),
                onClick: () => folderInputRef.current?.click(),
                color: 'gray',
              },
            ]}
            registry={window.extensionContext.extensionRegistry.pages.server.files.newFileContextMenu}
            registryProps={{}}
          >
            {({ openMenu }) => (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openMenu(rect.left, rect.bottom);
                }}
                color='blue'
                rightSection={<FontAwesomeIcon icon={faChevronDown} />}
              >
                {t('pages.server.files.button.new', {})}
              </Button>
            )}
          </ContextMenu>
        </ServerCan>
      )}
      {window.extensionContext.extensionRegistry.pages.server.files.fileToolbar.appendedComponents.map(
        (Component, i) => (
          <Component key={`files-fileToolbar-appended-${i}`} />
        ),
      )}
    </Group>
  );
}
