import {
  faPlay,
  faPlugCircleCheck,
  faPlugCircleXmark,
  faReply,
  faRotateRight,
  faSatellite,
  faStop,
  faTrash,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import sendNodeServersPowerAction from '@/api/admin/nodes/servers/sendNodeServersPowerAction.ts';
import clearServerState from '@/api/admin/servers/clearServerState.ts';
import deleteServer from '@/api/admin/servers/deleteServer.ts';
import updateServer from '@/api/admin/servers/updateServer.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import ServersTransferModal from '@/pages/admin/nodes/servers/modals/ServersTransferModal.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type PowerAction = 'start' | 'restart' | 'stop';
type ServerAction = PowerAction | 'transfer' | 'suspend' | 'unsuspend' | 'clearState' | 'delete';
type ConfirmableAction = Exclude<ServerAction, 'transfer'>;

const POWER_PERMISSION = ['nodes.read', 'nodes.power'];

const ACTIONS = [
  {
    action: 'start',
    icon: faPlay,
    color: 'green',
    permission: POWER_PERMISSION,
    label: 'common.enum.serverPowerAction.start',
  },
  {
    action: 'restart',
    icon: faRotateRight,
    color: undefined,
    permission: POWER_PERMISSION,
    label: 'common.enum.serverPowerAction.restart',
  },
  {
    action: 'stop',
    icon: faStop,
    color: 'red',
    permission: POWER_PERMISSION,
    label: 'common.enum.serverPowerAction.stop',
  },
  {
    action: 'transfer',
    icon: faReply,
    color: undefined,
    permission: ['nodes.read', 'nodes.transfers'],
    label: 'common.button.transfer',
  },
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
  icon: IconLike;
  color?: string;
  permission: string | string[];
  label: string;
}[];

const PAST_TENSE = {
  start: 'started',
  restart: 'restarted',
  stop: 'stopped',
  suspend: 'suspended',
  unsuspend: 'unsuspended',
  clearState: 'clearedState',
  delete: 'deleted',
} as const satisfies Record<ConfirmableAction, string>;

function isPowerAction(action: ServerAction): action is PowerAction {
  return action === 'start' || action === 'restart' || action === 'stop';
}

function request(
  action: Exclude<ConfirmableAction, PowerAction>,
  uuid: string,
  force: boolean,
  deleteBackups: boolean,
): Promise<void> {
  switch (action) {
    case 'suspend':
      return updateServer(uuid, { suspended: true });
    case 'unsuspend':
      return updateServer(uuid, { suspended: false });
    case 'clearState':
      return clearServerState(uuid);
    case 'delete':
      return deleteServer(uuid, { force, deleteBackups });
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

  const [loading, setLoading] = useState<ConfirmableAction | null>(null);
  const [confirming, setConfirming] = useState<ConfirmableAction | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [force, setForce] = useState(false);
  const [deleteBackups, setDeleteBackups] = useState(false);

  const targets = (action: ServerAction) => selectedServers.values().filter((server) => changesServer(action, server));

  const transferNode = (() => {
    const [first, ...rest] = selectedServers.values();

    return first && rest.every((server) => server.node.uuid === first.node.uuid) ? first.node : null;
  })();

  const report = (
    action: ConfirmableAction,
    successful: number,
    failed: number,
    skipped: number,
    firstError?: PromiseRejectedResult,
  ) => {
    const performed = t(`common.enum.bulkActionServerAction.${PAST_TENSE[action]}`, {});

    if (failed > 0) {
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

  const runPower = async (action: PowerAction) => {
    const servers = targets(action);
    const byNode = Map.groupBy(servers, (server) => server.node.uuid);

    setLoading(action);
    const results = await Promise.allSettled(
      Array.from(byNode, ([nodeUuid, nodeServers]) =>
        sendNodeServersPowerAction(
          nodeUuid,
          { type: 'uuids', uuids: nodeServers.map((server) => server.uuid) },
          action,
        ),
      ),
    );
    setLoading(null);

    const successful = results.reduce((sum, result) => sum + (result.status === 'fulfilled' ? result.value : 0), 0);
    report(
      action,
      successful,
      servers.length - successful,
      0,
      results.find((result) => result.status === 'rejected'),
    );
    clearSelectedServers();
  };

  const run = async (action: ConfirmableAction) => {
    if (isPowerAction(action)) {
      return runPower(action);
    }

    const servers = targets(action);
    const skipped = selectedServers.size - servers.length;

    setLoading(action);
    const results = await Promise.allSettled(
      servers.map((server) => request(action, server.uuid, force, deleteBackups)),
    );
    setLoading(null);

    const successful = results.filter((result) => result.status === 'fulfilled').length;
    report(
      action,
      successful,
      results.length - successful,
      skipped,
      results.find((result) => result.status === 'rejected'),
    );
    clearSelectedServers();
    invalidateServers();
  };

  const start = (action: ServerAction) => {
    if (action === 'transfer') {
      setTransferring(true);
      return;
    }

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
      return (
        <Stack>
          {t('pages.admin.servers.bulkActions.modal.deleteContent', { servers }).md()}

          <Switch
            label={t('common.form.force', {})}
            name='force'
            color='red'
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />

          {force && (
            <Alert color='red' icon={faTriangleExclamation}>
              {t('pages.admin.servers.bulkActions.modal.alert.forceWarning', {})}
            </Alert>
          )}

          <Switch
            label={t('pages.admin.servers.bulkActions.modal.form.deleteBackups', {})}
            name='deleteBackups'
            checked={deleteBackups}
            onChange={(e) => setDeleteBackups(e.target.checked)}
          />
        </Stack>
      );
    }

    return t('pages.admin.servers.bulkActions.modal.content', {
      action: t(`pages.admin.servers.bulkActions.verb.${confirming}`, {}),
      servers,
    }).md();
  };

  const closeConfirmation = () => {
    setConfirming(null);
    setForce(false);
    setDeleteBackups(false);
  };

  const onConfirmed = () => {
    const action = confirming;
    closeConfirmation();

    if (action) {
      run(action);
    }
  };

  return (
    <>
      {transferNode && (
        <AdminCan action={['nodes.read', 'nodes.transfers']}>
          <ServersTransferModal
            contextNode={transferNode}
            selector={{ type: 'uuids', uuids: selectedServers.keys() }}
            count={selectedServers.size}
            clearSelected={clearSelectedServers}
            opened={transferring}
            onClose={() => setTransferring(false)}
          />
        </AdminCan>
      )}

      <ConfirmationModal
        opened={confirming !== null}
        onClose={closeConfirmation}
        title={t('pages.admin.servers.bulkActions.modal.title', {})}
        confirm={t('common.button.continue', {})}
        onConfirmed={onConfirmed}
      >
        {confirmBody()}
      </ConfirmationModal>

      <ActionBar opened={selectedServers.size > 0}>
        {ACTIONS.map(({ action, icon, color, permission, label }) => {
          const applicable = action === 'transfer' && !transferNode ? 0 : targets(action).length;

          return (
            <AdminCan key={action} action={permission}>
              <Tooltip
                label={
                  action === 'transfer' && !transferNode
                    ? t('pages.admin.servers.bulkActions.transferMixedNodes', {})
                    : `${t(label, {})} (${tItem('server', applicable)})`
                }
              >
                <Button
                  color={color}
                  onClick={() => start(action)}
                  loading={loading === action}
                  disabled={(loading !== null && loading !== action) || applicable === 0}
                  aria-label={t(label, {})}
                  px='sm'
                >
                  <Icon icon={icon} />
                </Button>
              </Tooltip>
            </AdminCan>
          );
        })}
      </ActionBar>
    </>
  );
}
