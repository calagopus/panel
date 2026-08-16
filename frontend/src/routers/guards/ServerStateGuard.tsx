import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import unlockBackupRestore from '@/api/server/backups/unlockBackupRestore.ts';
import cancelServerInstall from '@/api/server/settings/cancelServerInstall.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import { isAdmin } from '@/lib/permissions.ts';
import { isConflictingState, serverStatusInfo } from '@/lib/server.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

export default function ServerStateGuard() {
  const { t } = useTranslations();
  const settings = useGlobalStore((state) => state.settings);
  const { user } = useAuth();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const updateServer = useServerStore((state) => state.updateServer);
  const canReadInstallationLogs = useAdminCan('servers.read');
  const location = useLocation();

  const [openModal, setOpenModal] = useState<'acknowledgeFailure' | null>(null);

  const acknowledge = useMemo(() => {
    if (server.status === 'install_failed') {
      if (!settings.server.allowAcknowledgingInstallationFailure && !isAdmin(user)) {
        return null;
      }

      return {
        permission: 'settings.cancel-install' as const,
        title: t('elements.screenBlock.serverConflict.modal.acknowledgeInstallFailure.title', {}),
        content: t('elements.screenBlock.serverConflict.modal.acknowledgeInstallFailure.content', {}),
        request: () => cancelServerInstall(server.uuid),
      };
    }

    if (server.status === 'backup_restore_failed') {
      return {
        permission: 'backups.restore' as const,
        title: t('elements.screenBlock.serverConflict.modal.acknowledgeBackupRestoreFailure.title', {}),
        content: t('elements.screenBlock.serverConflict.modal.acknowledgeBackupRestoreFailure.content', {}),
        request: () => unlockBackupRestore(server.uuid).then(() => true),
      };
    }

    return null;
  }, [server.status, server.uuid, settings.server.allowAcknowledgingInstallationFailure, user, t]);

  const doAcknowledgeFailure = async () => {
    await acknowledge
      ?.request()
      .then((cleared) => {
        if (cleared) {
          setOpenModal(null);
          updateServer({ status: null });
        }
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  if (
    (isConflictingState(server, user) &&
      location.pathname !== `/server/${server.uuid}` &&
      location.pathname !== `/server/${server.uuid}/` &&
      location.pathname !== `/server/${server.uuidShort}` &&
      location.pathname !== `/server/${server.uuidShort}/`) ||
    server.nodeMaintenanceEnabled ||
    (server.status !== null && serverStatusInfo[server.status].failed)
  ) {
    return (
      <ServerContentContainer title={t('elements.screenBlock.serverConflict.title', {})} hideTitleComponent>
        {acknowledge && (
          <ConfirmationModal
            opened={openModal === 'acknowledgeFailure'}
            onClose={() => setOpenModal(null)}
            title={acknowledge.title}
            onConfirmed={doAcknowledgeFailure}
          >
            {acknowledge.content.md()}
          </ConfirmationModal>
        )}

        <ScreenBlock
          title={t('elements.screenBlock.serverConflict.title', {})}
          content={
            server.isSuspended
              ? t('elements.screenBlock.serverConflict.contentSuspended', {})
              : server.nodeMaintenanceEnabled
                ? t('elements.screenBlock.serverConflict.contentNodeMaintenance', {})
                : server.isTransferring
                  ? t('elements.screenBlock.serverConflict.contentTransferring', {})
                  : server.status
                    ? serverStatusInfo[server.status].blockContent()
                    : ''
          }
        />
        <div className='flex flex-row items-center justify-center gap-4 mt-6'>
          {canReadInstallationLogs && server.status === 'install_failed' && (
            <NavLink to={`/admin/servers/${server.uuid}/logs`}>
              <Button variant='outline'>{t('elements.screenBlock.serverConflict.button.viewInstallLogs', {})}</Button>
            </NavLink>
          )}
          {acknowledge && (
            <ServerCan action={acknowledge.permission}>
              <Button color='red' onClick={() => setOpenModal('acknowledgeFailure')}>
                {t('elements.screenBlock.serverConflict.button.acknowledgeFailure', {})}
              </Button>
            </ServerCan>
          )}
        </div>
      </ServerContentContainer>
    );
  }

  return <Outlet />;
}
