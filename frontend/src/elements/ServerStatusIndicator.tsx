import {
  faBan,
  faPlay,
  faRotateRight,
  faSkull,
  faStop,
  faTowerBroadcast,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { serverStatusInfo, statusToColor } from '@/lib/server.ts';
import { formatMilliseconds } from '@/lib/time.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerStatusIndicator() {
  const { t } = useTranslations();
  const params = useParams<'id'>();
  const [open, setOpen] = useState(false);
  const { server, state, stats, socketInstance, socketConnected } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      state: state.state,
      stats: state.stats,
      socketInstance: state.socketInstance,
      socketConnected: state.socketConnected,
    })),
  );

  const canStart = useServerCan('control.start');
  const canStop = useServerCan('control.stop');
  const canRestart = useServerCan('control.restart');

  const killable = state === 'stopping';
  const isOffline = state === 'offline';
  const canPower = isOffline ? canStart : canStop;

  const powerBlocked =
    !socketConnected || !!server.status || server.isSuspended || server.isTransferring || server.nodeMaintenanceEnabled;

  const { indicator, label } = useMemo((): { indicator: ReactNode; label: string } => {
    const dot = (pulse: boolean) => (
      <span className={classNames('rounded-full size-2', statusToColor(state), pulse && 'animate-pulse')} />
    );
    const icon = (definition: typeof faBan, className?: string) => (
      <FontAwesomeIcon icon={definition} className={classNames('size-3', className)} />
    );
    const spinner = <Spinner size={12} />;

    if (!socketConnected) {
      return {
        indicator: icon(faTowerBroadcast, 'text-(--mantine-color-dimmed)'),
        label: t('common.enum.connectionStatus.offline', {}),
      };
    }
    if (server.isSuspended) {
      return { indicator: icon(faBan, 'text-server-status-offline'), label: t('common.server.state.suspended', {}) };
    }
    if (server.isTransferring) {
      return { indicator: spinner, label: t('common.server.state.transferring', {}) };
    }
    if (server.nodeMaintenanceEnabled) {
      return {
        indicator: icon(faBan, 'text-server-status-offline'),
        label: t('common.server.state.nodeMaintenance', {}),
      };
    }
    if (server.status) {
      const status = serverStatusInfo[server.status];

      return {
        indicator: status.failed ? icon(faTriangleExclamation, 'text-server-status-starting') : spinner,
        label: status.label(),
      };
    }

    return {
      indicator: dot(state === 'starting' || state === 'stopping'),
      label: t(`common.enum.serverState.${state ?? 'unknown'}`, {}),
    };
  }, [
    socketConnected,
    server.isSuspended,
    server.isTransferring,
    server.nodeMaintenanceEnabled,
    server.status,
    state,
    t,
  ]);

  const uptime = state === 'running' && stats?.uptime ? formatMilliseconds(stats.uptime, true, false) : null;

  const onPowerAction = (action: z.infer<typeof serverPowerAction> | 'kill-confirmed') => {
    if (action === 'kill') {
      return setOpen(true);
    }

    if (socketInstance) {
      setOpen(false);
      socketInstance.send(SocketRequest.SET_STATE, action === 'kill-confirmed' ? 'kill' : action);
    }
  };

  useEffect(() => {
    if (state === 'offline') {
      setOpen(false);
    }
  }, [state]);

  if (!params.id) {
    return null;
  }

  const buttonAction = isOffline ? 'start' : killable ? 'kill' : 'stop';

  return (
    <>
      <Card p='xs' className='min-h-fit'>
        <div className='h-5 flex items-center min-w-0'>
          <span className='text-sm font-medium min-w-0 flex-1'>
            <ScrollingText>{server.name}</ScrollingText>
          </span>
        </div>

        <div className='h-4 flex items-center gap-2 min-w-0'>
          <span className='size-3 shrink-0 flex items-center justify-center'>{indicator}</span>
          <span className='text-xs leading-4 truncate text-(--mantine-color-dimmed)'>{label}</span>
          {uptime && <span className='text-xs leading-4 ml-auto shrink-0 text-(--mantine-color-dimmed)'>{uptime}</span>}
        </div>

        {(canPower || canRestart) && (
          <div className='flex gap-2 mt-2'>
            {canPower && (
              <Button
                size='xs'
                color={isOffline ? 'green' : 'red'}
                disabled={powerBlocked}
                onClick={() => onPowerAction(buttonAction)}
                className='flex-1 min-w-0'
                leftSection={<FontAwesomeIcon icon={isOffline ? faPlay : killable ? faSkull : faStop} size='xs' />}
              >
                {t(`common.enum.serverPowerAction.${buttonAction}`, {})}
              </Button>
            )}
            {canRestart && (
              <Tooltip
                label={t('common.enum.serverPowerAction.restart', {})}
                className={canPower ? undefined : 'flex-1'}
              >
                <Button
                  size='xs'
                  color='gray'
                  disabled={powerBlocked || isOffline}
                  onClick={() => onPowerAction('restart')}
                  fullWidth={!canPower}
                  className={canPower ? 'px-2.5!' : undefined}
                >
                  <FontAwesomeIcon icon={faRotateRight} size='xs' />
                </Button>
              </Tooltip>
            )}
          </div>
        )}
      </Card>

      <ConfirmationModal
        opened={open}
        onClose={() => setOpen(false)}
        title={t('pages.server.console.power.modal.forceStop.title', {})}
        confirm={t('common.button.continue', {})}
        onConfirmed={() => onPowerAction('kill-confirmed')}
      >
        {t('pages.server.console.power.modal.forceStop.content', {})}
      </ConfirmationModal>
    </>
  );
}
