import { faBan, faTowerBroadcast, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { ReactNode, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { serverStatusInfo, statusToColor } from '@/lib/domain/server.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export function useServerStatusLabel(): { indicator: ReactNode; label: string } {
  const { t } = useTranslations();
  const { server, state, socketConnected } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      state: state.state,
      socketConnected: state.socketConnected,
    })),
  );

  return useMemo(() => {
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
}
