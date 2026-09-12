import {
  faPlugCircleCheck,
  faPlugCircleXmark,
  faSatellite,
  faTrash,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import clearServerState from '@/api/admin/servers/clearServerState.ts';
import deleteServer from '@/api/admin/servers/deleteServer.ts';
import updateServer from '@/api/admin/servers/updateServer.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type ServerAction = 'suspend' | 'unsuspend' | 'clearState' | 'delete';

const ACTIONS = [
  {
    action: 'clearState',
    icon: faSatellite,
    color: undefined,
    permission: 'servers.update',
    label: 'pages.admin.servers.tabs.management.page.clearState.button',
  },
  {
    action: 'unsuspend',
    icon: faPlugCircleCheck,
    color: undefined,
    permission: 'servers.update',
    label: 'pages.admin.servers.tabs.management.page.unsuspend.button',
  },
  {
    action: 'suspend',
    icon: faPlugCircleXmark,
    color: 'red',
    permission: 'servers.update',
    label: 'pages.admin.servers.tabs.management.page.suspend.button',
  },
  {
    action: 'delete',
    icon: faTrash,
    color: 'red',
    permission: 'servers.delete',
    label: 'common.button.delete',
  },
] as const satisfies readonly {
  action: ServerAction;
  icon: IconDefinition;
  color?: string;
  permission: string;
  label: string;
}[];

const PAST_TENSE = {
  suspend: 'suspended',
  unsuspend: 'unsuspended',
  clearState: 'clearedState',
  delete: 'deleted',
} as const satisfies Record<ServerAction, string>;

function request(action: ServerAction, uuid: string): Promise<void> {
  switch (action) {
    case 'suspend':
      return updateServer(uuid, { suspended: true });
    case 'unsuspend':
      return updateServer(uuid, { suspended: false });
    case 'clearState':
      return clearServerState(uuid);
    case 'delete':
      return deleteServer(uuid, { force: false, deleteBackups: false });
  }
}

/**
 * Whether an action would actually change the server. Suspending a server that is already
 * suspended, or unsuspending one that is not, leaves it exactly as it was.
 */
function changesServer(action: ServerAction, server: AdminServer): boolean {
  switch (action) {
    case 'suspend':
      return !server.isSuspended;
    case 'unsuspend':
      return server.isSuspended;
    default:
      return true;
  }
}

export default function ServerActionBar({
  selectedServers,
  clearSelectedServers,
  invalidateServers,
}: {
  selectedServers: ObjectSet<AdminServer, 'uuid'>;
  clearSelectedServers: () => void;
  invalidateServers: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const [loading, setLoading] = useState<ServerAction | null>(null);
  const [confirming, setConfirming] = useState<ServerAction | null>(null);

  const targets = (action: ServerAction) => selectedServers.values().filter((server) => changesServer(action, server));

  const report = (action: ServerAction, results: PromiseSettledResult<void>[], skipped: number) => {
    const successful = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - successful;
    const performed = t(`common.enum.bulkActionServerAction.${PAST_TENSE[action]}`, {});

    if (failed > 0) {
      const firstError = results.find((result) => result.status === 'rejected');

      if (successful === 0 && firstError) {
        addToast(httpErrorToHuman(firstError.reason), 'error');
        return;
      }

      addToast(
        t('pages.account.home.bulkActions.partial', {
          action: performed,
          successfulServers: tItem('server', successful),
          failedServers: tItem('server', failed),
        }),
        'warning',
      );
      return;
    }

    if (skipped > 0) {
      addToast(
        t('pages.admin.servers.bulkActions.successWithSkipped', {
          action: performed,
          servers: tItem('server', successful),
          skippedServers: tItem('server', skipped),
        }),
        'success',
      );
      return;
    }

    addToast(
      t('pages.account.home.bulkActions.success', { action: performed, servers: tItem('server', successful) }),
      'success',
    );
  };

  const run = async (action: ServerAction) => {
    const servers = targets(action);
    const skipped = selectedServers.size - servers.length;

    setLoading(action);
    const results = await Promise.allSettled(servers.map((server) => request(action, server.uuid)));
    setLoading(null);

    report(action, results, skipped);
    clearSelectedServers();
    invalidateServers();
  };

  const start = (action: ServerAction) => {
    if (targets(action).length === 0) {
      addToast(t('pages.admin.servers.bulkActions.nothingToDo', {}), 'info');
      return;
    }

    setConfirming(action);
  };

  const confirmBody = () => {
    if (!confirming) {
      return null;
    }

    const servers = tItem('server', targets(confirming).length);

    if (confirming === 'delete') {
      return t('pages.admin.servers.bulkActions.modal.deleteContent', { servers }).md();
    }

    return t('pages.admin.servers.bulkActions.modal.content', {
      action: t(`pages.admin.servers.bulkActions.verb.${confirming}`, {}),
      servers,
    }).md();
  };

  const onConfirmed = () => {
    const action = confirming;
    setConfirming(null);

    if (action) {
      run(action);
    }
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming !== null}
        onClose={() => setConfirming(null)}
        title={t('pages.admin.servers.bulkActions.modal.title', {})}
        confirm={t('common.button.continue', {})}
        onConfirmed={onConfirmed}
      >
        {confirmBody()}
      </ConfirmationModal>

      <ActionBar opened={selectedServers.size > 0}>
        {ACTIONS.map(({ action, icon, color, permission, label }) => (
          <AdminCan key={action} action={permission}>
            <Tooltip label={`${t(label, {})} (${tItem('server', selectedServers.size)})`}>
              <Button
                color={color}
                onClick={() => start(action)}
                loading={loading === action}
                disabled={loading !== null && loading !== action}
                aria-label={t(label, {})}
                px='sm'
              >
                <FontAwesomeIcon icon={icon} />
              </Button>
            </Tooltip>
          </AdminCan>
        ))}
      </ActionBar>
    </>
  );
}
