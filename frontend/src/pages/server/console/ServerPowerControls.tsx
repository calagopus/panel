import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerPowerControls() {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const { server, state, socketInstance, socketConnected } = useServerStore(
    useShallow((s) => ({
      server: s.server,
      state: s.state,
      socketInstance: s.socketInstance,
      socketConnected: s.socketConnected,
    })),
  );

  const killable = state === 'stopping';

  const onButtonClick = (action: z.infer<typeof serverPowerAction> | 'kill-confirmed') => {
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

  return (
    <div className='flex w-full md:w-fit gap-2'>
      <ConfirmationModal
        opened={open}
        onClose={() => setOpen(false)}
        title={t('pages.server.console.power.modal.forceStop.title', {})}
        confirm={t('common.button.continue', {})}
        onConfirmed={() => onButtonClick('kill-confirmed')}
      >
        {t('pages.server.console.power.modal.forceStop.content', {}).md()}
      </ConfirmationModal>

      {window.extensionContext.extensionRegistry.pages.server.console.powerButtonComponents.prependedComponents.map(
        (Component, i) => (
          <Component key={`console-powerbutton-prepended-${i}`} />
        ),
      )}

      <ServerCan action='control.start'>
        <Button
          color='green'
          disabled={
            !socketConnected || state !== 'offline' || !!server.status || server.isSuspended || server.isTransferring
          }
          loading={state === 'starting'}
          onClick={() => onButtonClick('start')}
          className='flex-1 min-w-fit'
        >
          {t('common.enum.serverPowerAction.start', {})}
        </Button>
      </ServerCan>
      <ServerCan action='control.restart'>
        <Button
          color='gray'
          disabled={!socketConnected || !state || !!server.status || server.isSuspended || server.isTransferring}
          onClick={() => onButtonClick('restart')}
          className='flex-1 min-w-fit'
        >
          {t('common.enum.serverPowerAction.restart', {})}
        </Button>
      </ServerCan>
      <ServerCan action='control.stop'>
        <Button
          color='red'
          disabled={
            !socketConnected || state === 'offline' || !!server.status || server.isSuspended || server.isTransferring
          }
          onClick={() => onButtonClick(killable ? 'kill' : 'stop')}
          className='flex-1 min-w-fit'
        >
          {killable ? t('common.enum.serverPowerAction.kill', {}) : t('common.enum.serverPowerAction.stop', {})}
        </Button>
      </ServerCan>

      {window.extensionContext.extensionRegistry.pages.server.console.powerButtonComponents.appendedComponents.map(
        (Component, i) => (
          <Component key={`console-powerButton-appended-${i}`} />
        ),
      )}
    </div>
  );
}
