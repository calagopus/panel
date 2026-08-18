import { faExternalLink, faPause, faPlay, faReply, faSatellite, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/coreQuickActions.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import ServerClearStateModal from '@/pages/admin/servers/management/modals/ServerClearStateModal.tsx';
import ServerDeleteModal from '@/pages/admin/servers/management/modals/ServerDeleteModal.tsx';
import ServerSuspendModal from '@/pages/admin/servers/management/modals/ServerSuspendModal.tsx';
import ServerTransferModal from '@/pages/admin/servers/management/modals/ServerTransferModal.tsx';
import ServerUnsuspendModal from '@/pages/admin/servers/management/modals/ServerUnsuspendModal.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useQuickActions } from '@/plugins/useQuickActions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function AdminServerActions({ server }: { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const canTransfer = useAdminCan(['servers.transfer', 'nodes.read'], false);

  const openModal = useAdminStore((state) => state.serverModal);
  const doOpenModal = useAdminStore((state) => state.doOpenServerModal);
  const doCloseModal = useAdminStore((state) => state.doCloseServerModal);

  useEffect(() => doCloseModal, [server.uuid]);

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
    {
      id: 'admin.servers.transfer',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.admin.servers.quickAction.transfer', {}),
      keywords: ['node', 'move'],
      icon: <FontAwesomeIcon icon={faReply} />,
      isVisible: () => canTransfer,
      perform: () => doOpenModal('transfer'),
    },
    {
      id: 'admin.servers.suspend',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.admin.servers.quickAction.suspend', {}),
      icon: <FontAwesomeIcon icon={faPause} />,
      danger: true,
      adminPermission: 'servers.update',
      isVisible: () => !server.isSuspended,
      perform: () => doOpenModal('suspend'),
    },
    {
      id: 'admin.servers.unsuspend',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.admin.servers.quickAction.unsuspend', {}),
      icon: <FontAwesomeIcon icon={faPlay} />,
      adminPermission: 'servers.update',
      isVisible: () => server.isSuspended,
      perform: () => doOpenModal('unsuspend'),
    },
    {
      id: 'admin.servers.clearState',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.admin.servers.quickAction.clearState', {}),
      keywords: ['status', 'stuck'],
      icon: <FontAwesomeIcon icon={faSatellite} />,
      danger: true,
      adminPermission: 'servers.update',
      perform: () => doOpenModal('clear-state'),
    },
    {
      id: 'admin.servers.delete',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.admin.servers.quickAction.delete', {}),
      icon: <FontAwesomeIcon icon={faTrash} />,
      danger: true,
      adminPermission: 'servers.delete',
      perform: () => doOpenModal('delete'),
    },
  ]);

  return (
    <>
      {canTransfer && <ServerTransferModal server={server} opened={openModal === 'transfer'} onClose={doCloseModal} />}
      <ServerSuspendModal server={server} opened={openModal === 'suspend'} onClose={doCloseModal} />
      <ServerUnsuspendModal server={server} opened={openModal === 'unsuspend'} onClose={doCloseModal} />
      <ServerClearStateModal server={server} opened={openModal === 'clear-state'} onClose={doCloseModal} />
      <ServerDeleteModal server={server} opened={openModal === 'delete'} onClose={doCloseModal} />
    </>
  );
}
