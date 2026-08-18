import { faPlay, faRotateRight, faSkull, faStop } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/coreQuickActions.tsx';
import { useQuickActions } from '@/plugins/useQuickActions.ts';
import { SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

/** Mounted by the server router, so these exist exactly as long as a server is being viewed. */
export default function ServerQuickActions() {
  const { t } = useTranslations();
  const { socketInstance, serverState } = useServerStore(
    useShallow((state) => ({ socketInstance: state.socketInstance, serverState: state.state })),
  );

  const [killConfirmOpen, setKillConfirmOpen] = useState(false);

  const power = CORE_QUICK_ACTION_CATEGORIES.power;

  useQuickActions([
    {
      id: 'server.start',
      category: power,
      label: () => t('common.enum.serverPowerAction.start', {}),
      icon: <FontAwesomeIcon icon={faPlay} />,
      permission: 'control.start',
      isVisible: () => serverState === 'offline',
      perform: () => socketInstance?.send(SocketRequest.SET_STATE, 'start'),
    },
    {
      id: 'server.stop',
      category: power,
      label: () => t('common.enum.serverPowerAction.stop', {}),
      icon: <FontAwesomeIcon icon={faStop} />,
      permission: 'control.stop',
      isVisible: () => serverState !== 'offline' && serverState !== 'stopping',
      perform: () => socketInstance?.send(SocketRequest.SET_STATE, 'stop'),
    },
    {
      id: 'server.restart',
      category: power,
      label: () => t('common.enum.serverPowerAction.restart', {}),
      icon: <FontAwesomeIcon icon={faRotateRight} />,
      permission: 'control.restart',
      isVisible: () => serverState === 'running',
      perform: () => socketInstance?.send(SocketRequest.SET_STATE, 'restart'),
    },
    {
      id: 'server.kill',
      category: power,
      label: () => t('common.enum.serverPowerAction.kill', {}),
      icon: <FontAwesomeIcon icon={faSkull} />,
      danger: true,
      permission: 'control.stop',
      isVisible: () => serverState === 'stopping',
      perform: () => setKillConfirmOpen(true),
    },
  ]);

  return (
    <ConfirmationModal
      opened={killConfirmOpen}
      onClose={() => setKillConfirmOpen(false)}
      title={t('pages.server.console.power.modal.forceStop.title', {})}
      confirm={t('common.button.continue', {})}
      onConfirmed={() => {
        socketInstance?.send(SocketRequest.SET_STATE, 'kill');
        setKillConfirmOpen(false);
      }}
    >
      {t('pages.server.console.power.modal.forceStop.content', {})}
    </ConfirmationModal>
  );
}
