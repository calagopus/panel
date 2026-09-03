import { faExternalLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import ServerConfirmActionModal from '@/pages/admin/servers/management/modals/ServerConfirmActionModal.tsx';
import ServerDeleteModal from '@/pages/admin/servers/management/modals/ServerDeleteModal.tsx';
import ServerTransferModal from '@/pages/admin/servers/management/modals/ServerTransferModal.tsx';
import { useServerManagementActions } from '@/pages/admin/servers/management/serverManagementActions.tsx';
import { useQuickActions } from '@/plugins/quick-actions/useQuickActions.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function AdminServerActions({ server }: { server: AdminServer }) {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const canTransfer = useAdminCan(['servers.transfer', 'nodes.read'], false);

  const openModal = useAdminStore((state) => state.serverModal);
  const doOpenModal = useAdminStore((state) => state.doOpenServerModal);
  const doCloseModal = useAdminStore((state) => state.doCloseServerModal);

  const actions = useServerManagementActions(server);

  useEffect(() => {
    doCloseModal();
  }, [server.uuid, doCloseModal]);

  useQuickActions([
    {
      id: 'admin.servers.viewClient',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.admin.servers.quickAction.viewClient', {}),
      keywords: ['client'],
      icon: <FontAwesomeIcon icon={faExternalLink} />,
      adminPermission: 'servers.read',
      perform: () => navigate(`/server/${server.uuidShort}`),
    },
    ...actions.map((action) => ({
      id: `admin.servers.${action.id}`,
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => action.paletteLabel,
      keywords: action.paletteKeywords,
      icon: <FontAwesomeIcon icon={action.icon} />,
      danger: action.danger || undefined,
      perform: () => doOpenModal(action.modal),
    })),
  ]);

  return (
    <>
      {canTransfer && <ServerTransferModal server={server} opened={openModal === 'transfer'} onClose={doCloseModal} />}
      <ServerConfirmActionModal
        server={server}
        action='suspend'
        opened={openModal === 'suspend'}
        onClose={doCloseModal}
      />
      <ServerConfirmActionModal
        server={server}
        action='unsuspend'
        opened={openModal === 'unsuspend'}
        onClose={doCloseModal}
      />
      <ServerConfirmActionModal
        server={server}
        action='clear-state'
        opened={openModal === 'clear-state'}
        onClose={doCloseModal}
      />
      <ServerDeleteModal server={server} opened={openModal === 'delete'} onClose={doCloseModal} />
    </>
  );
}
