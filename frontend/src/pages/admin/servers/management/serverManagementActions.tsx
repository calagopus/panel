import { faPause, faPlay, faReply, faSatellite, faTrash, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import type { AdminServerModal } from '@/stores/slices/admin/server.ts';

const mgmt = 'pages.admin.servers.tabs.management.page';
const palette = 'pages.admin.servers.quickAction';

export interface ServerManagementAction {
  id: 'transfer' | 'suspend' | 'unsuspend' | 'clearState' | 'delete';
  modal: AdminServerModal;
  icon: IconDefinition;
  color: 'blue' | 'green' | 'red';
  danger: boolean;
  orderClass: string;
  paletteLabel: string;
  paletteKeywords?: string[];
  cardTitle: string;
  cardContent: string;
  cardButtonLabel: string;
}

export function useServerManagementActions(server: AdminServer): ServerManagementAction[] {
  const { t } = useTranslations();
  const canTransfer = useAdminCan(['servers.transfer', 'nodes.read'], false);
  const canUpdate = useAdminCan('servers.update');
  const canDelete = useAdminCan('servers.delete');

  const actions: (ServerManagementAction | false)[] = [
    canTransfer && {
      id: 'transfer',
      modal: 'transfer',
      icon: faReply,
      color: 'blue',
      danger: false,
      orderClass: 'order-10',
      paletteLabel: t(`${palette}.transfer`, {}),
      paletteKeywords: ['node', 'move'],
      cardTitle: t(`${mgmt}.transfer.title`, {}),
      cardContent: t(`${mgmt}.transfer.content`, {}),
      cardButtonLabel: t('common.button.transfer', {}),
    },
    canUpdate &&
      !server.isSuspended && {
        id: 'suspend',
        modal: 'suspend',
        icon: faPause,
        color: 'red',
        danger: true,
        orderClass: 'order-20',
        paletteLabel: t(`${palette}.suspend`, {}),
        cardTitle: t(`${mgmt}.suspend.title`, {}),
        cardContent: t(`${mgmt}.suspend.content`, {}),
        cardButtonLabel: t(`${mgmt}.suspend.button`, {}),
      },
    canUpdate &&
      server.isSuspended && {
        id: 'unsuspend',
        modal: 'unsuspend',
        icon: faPlay,
        color: 'green',
        danger: false,
        orderClass: 'order-20',
        paletteLabel: t(`${palette}.unsuspend`, {}),
        cardTitle: t(`${mgmt}.unsuspend.title`, {}),
        cardContent: t(`${mgmt}.unsuspend.content`, {}),
        cardButtonLabel: t(`${mgmt}.unsuspend.button`, {}),
      },
    canUpdate && {
      id: 'clearState',
      modal: 'clear-state',
      icon: faSatellite,
      color: 'red',
      danger: true,
      orderClass: 'order-30',
      paletteLabel: t(`${palette}.clearState`, {}),
      paletteKeywords: ['status', 'stuck'],
      cardTitle: t(`${mgmt}.clearState.title`, {}),
      cardContent: t(`${mgmt}.clearState.content`, {}),
      cardButtonLabel: t(`${mgmt}.clearState.button`, {}),
    },
    canDelete && {
      id: 'delete',
      modal: 'delete',
      icon: faTrash,
      color: 'red',
      danger: true,
      orderClass: 'order-40',
      paletteLabel: t(`${palette}.delete`, {}),
      cardTitle: t(`${mgmt}.delete.title`, {}),
      cardContent: t(`${mgmt}.delete.content`, {}),
      cardButtonLabel: t('common.button.delete', {}),
    },
  ];

  return actions.filter((action): action is ServerManagementAction => action !== false);
}
