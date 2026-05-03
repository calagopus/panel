import { faPlay, faRefresh, faSkull, faStop, faTowerBroadcast } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { statusToColor } from '@/lib/server.ts';
import { SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import Divider from './Divider.tsx';

export default function ServerStatusIndicator() {
  const { t } = useTranslations();
  const params = useParams<'id'>();
  const [open, setOpen] = useState(false);
  const { server, state, socketInstance, socketConnected } = useServerStore();

  const killable = state === 'stopping';

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

  const isOffline = state === 'offline';

  const buttonAction = isOffline ? 'start' : killable ? 'kill' : 'stop';
  const buttonColor = isOffline ? 'green' : 'red';
  const buttonIcon = isOffline ? faPlay : killable ? faSkull : faStop;

  return (
    <div className='flex flex-col gap-2'>
      <Divider my={2} />
      <div className='flex justify-start items-center gap-3 pl-2.5'>
        <Group gap='xs'>
          <ServerCan action={['control.start', 'control.stop']} matchAny>
            <Tooltip label={t(`common.enum.serverPowerAction.${buttonAction}`, {})}>
              <ActionIcon
                size='lg'
                radius='md'
                color={buttonColor}
                disabled={!socketConnected || !!server.status || server.isSuspended || server.isTransferring}
                onClick={() => onPowerAction(buttonAction)}
              >
                <FontAwesomeIcon icon={buttonIcon} size='sm' />
              </ActionIcon>
            </Tooltip>
          </ServerCan>
          <ServerCan action='control.restart'>
            <Tooltip label={t('common.enum.serverPowerAction.restart', {})}>
              <ActionIcon
                size='lg'
                radius='md'
                color='gray'
                disabled={
                  !socketConnected ||
                  state === 'offline' ||
                  !!server.status ||
                  server.isSuspended ||
                  server.isTransferring
                }
                onClick={() => onPowerAction('restart')}
              >
                <FontAwesomeIcon icon={faRefresh} size='sm' />
              </ActionIcon>
            </Tooltip>
          </ServerCan>
        </Group>

        <div className='flex items-center gap-1.5 text-xs'>
          {socketConnected ? (
            <>
              <span className={classNames('rounded-full size-4 animate-pulse', statusToColor(state))} />
              <span className='font-medium leading-none'>{t(`common.enum.serverState.${state}`, {})}</span>
            </>
          ) : (
            <>
              <FontAwesomeIcon
                icon={faTowerBroadcast}
                className={`${socketConnected ? 'animate-pulse text-green-500' : ''} w-4`}
              />
              <span className='font-medium leading-none'>
                {socketConnected
                  ? t('common.enum.connectionStatus.connected', {})
                  : t('common.enum.connectionStatus.offline', {})}
              </span>
            </>
          )}
        </div>

        <div className='flex items-center gap-1.5 text-xs'></div>
      </div>

      <ConfirmationModal
        opened={open}
        onClose={() => setOpen(false)}
        title={t('pages.server.console.power.modal.forceStop.title', {})}
        confirm={t('common.button.continue', {})}
        onConfirmed={() => onPowerAction('kill-confirmed')}
      >
        {t('pages.server.console.power.modal.forceStop.content', {})}
      </ConfirmationModal>
    </div>
  );
}
