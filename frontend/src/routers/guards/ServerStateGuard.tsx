import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import cancelServerInstall from '@/api/server/settings/cancelServerInstall.ts';
import Button from '@/elements/Button.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import { isAdmin } from '@/lib/permissions.ts';
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

  const doAcknowledgeFailure = async () => {
    await cancelServerInstall(server.uuid)
      .then((instantCancel) => {
        if (instantCancel) {
          setOpenModal(null);
          updateServer({ status: null });
        }
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  if (
    (((server.isSuspended && !isAdmin(user)) || server.status !== null || server.isTransferring) &&
      location.pathname !== `/server/${server.uuid}` &&
      location.pathname !== `/server/${server.uuid}/` &&
      location.pathname !== `/server/${server.uuidShort}` &&
      location.pathname !== `/server/${server.uuidShort}/`) ||
    server.nodeMaintenanceEnabled ||
    server.status === 'install_failed'
  ) {
    return (
      <ServerContentContainer title={t('elements.screenBlock.serverConflict.title', {})} hideTitleComponent>
        <ConfirmationModal
          opened={openModal === 'acknowledgeFailure'}
          onClose={() => setOpenModal(null)}
          title={t('elements.screenBlock.serverConflict.modal.acknowledgeFailure.title', {})}
          onConfirmed={doAcknowledgeFailure}
        >
          {t('elements.screenBlock.serverConflict.modal.acknowledgeFailure.content', {}).md()}
        </ConfirmationModal>

        <ScreenBlock
          title={t('elements.screenBlock.serverConflict.title', {})}
          content={
            server.isSuspended
              ? t('elements.screenBlock.serverConflict.contentSuspended', {})
              : server.nodeMaintenanceEnabled
                ? t('elements.screenBlock.serverConflict.contentNodeMaintenance', {})
                : server.isTransferring
                  ? t('elements.screenBlock.serverConflict.contentTransferring', {})
                  : server.status === 'install_failed'
                    ? t('elements.screenBlock.serverConflict.contentInstallFailed', {})
                    : server.status === 'installing'
                      ? t('elements.screenBlock.serverConflict.contentInstalling', {})
                      : t('elements.screenBlock.serverConflict.contentRestoringBackup', {})
          }
        />
        <div className='flex flex-row items-center justify-center gap-4 mt-6'>
          {canReadInstallationLogs && server.status === 'install_failed' && (
            <NavLink to={`/admin/servers/${server.uuid}/logs`}>
              <Button variant='outline'>{t('elements.screenBlock.serverConflict.button.viewInstallLogs', {})}</Button>
            </NavLink>
          )}
          {(settings.server.allowAcknowledgingInstallationFailure || isAdmin(user)) &&
            server.status === 'install_failed' && (
              <Button color='red' onClick={() => setOpenModal('acknowledgeFailure')}>
                {t('elements.screenBlock.serverConflict.button.acknowledgeFailure', {})}
              </Button>
            )}
        </div>
      </ServerContentContainer>
    );
  }

  return <Outlet />;
}
