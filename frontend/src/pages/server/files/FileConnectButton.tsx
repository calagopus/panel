import { faChevronDown, faCode, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { vscodeConnectUrl } from '@/lib/files/files.ts';
import { openUrl } from '@/lib/network/url.ts';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import { useQuickActions } from '@/plugins/quick-actions/useQuickActions.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import SftpDetailsModal from './modals/SftpDetailsModal.tsx';

export default function FileConnectButton({ file }: { file?: string }) {
  const { t } = useTranslations();
  const { user } = useAuth();
  const server = useServerStore((state) => state.server);
  const { vscodeUriScheme, openModal, doOpenModal, doCloseModal } = useFileManager(
    useShallow((state) => ({
      vscodeUriScheme: state.vscodeUriScheme,
      openModal: state.openModal,
      doOpenModal: state.doOpenModal,
      doCloseModal: state.doCloseModal,
    })),
  );
  const canSftp = useServerCan('files.sftp');

  const sftpUrl = `sftp://${user!.username}.${server.uuidShort}@${server.sftpHost}:${server.sftpPort}`;
  const vscodeUrl = vscodeConnectUrl(vscodeUriScheme, server.uuid, file);

  useQuickActions([
    {
      id: 'files.connectSftp',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.quickAction.connectSftp', {}),
      keywords: ['sftp', 'ftp'],
      icon: <FontAwesomeIcon icon={faServer} />,
      permission: 'files.sftp',
      perform: () => doOpenModal('sftp'),
    },
    {
      id: 'files.connectVscode',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.quickAction.connectVscode', {}),
      keywords: ['vscode', 'editor'],
      icon: <FontAwesomeIcon icon={faCode} />,
      permission: 'files.read-content',
      perform: () => openUrl(vscodeUrl),
    },
  ]);

  return (
    <>
      <ServerCan action='files.sftp'>
        <SftpDetailsModal opened={openModal === 'sftp'} onClose={doCloseModal} />
      </ServerCan>
      <ServerCan action='files.read-content'>
        <ContextMenu
          menuProps={{ position: 'bottom-start' }}
          items={[
            {
              type: 'action',
              icon: faServer,
              label: t('pages.server.files.button.connectSftp', {}),
              onClick: (e) => {
                if (e.shiftKey) {
                  window.location.href = sftpUrl;
                } else {
                  doOpenModal('sftp');
                }
              },
              color: 'gray',
              canAccess: canSftp,
            },
            {
              type: 'action',
              icon: faCode,
              label: t('pages.server.files.button.connectVscode', {}),
              onClick: () => openUrl(vscodeUrl),
              color: 'gray',
            },
          ]}
        >
          {({ openMenu }) => (
            <Button
              variant='outline'
              leftSection={<FontAwesomeIcon icon={faServer} />}
              rightSection={<FontAwesomeIcon icon={faChevronDown} />}
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                openMenu(rect.left, rect.bottom);
              }}
            >
              {t('pages.server.files.button.connect', {})}
            </Button>
          )}
        </ContextMenu>
      </ServerCan>
    </>
  );
}
