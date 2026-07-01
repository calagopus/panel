import { useEffect, useRef } from 'react';
import { useServerStore } from '@/stores/server.ts';

export enum SocketEvent {
  PONG = 'pong',
  DAEMON_MESSAGE = 'daemon message',
  DAEMON_ERROR = 'daemon error',
  INSTALL_STARTED = 'install started',
  INSTALL_OUTPUT = 'install output',
  INSTALL_COMPLETED = 'install completed',
  IMAGE_PULL_PROGRESS = 'image pull progress',
  IMAGE_PULL_COMPLETED = 'image pull completed',
  CONSOLE_OUTPUT = 'console output',
  STATUS = 'status',
  STATS = 'stats',
  PENDING_RESTART = 'pending restart',
  TRANSFER_LOGS = 'transfer logs',
  TRANSFER_STATUS = 'transfer status',
  TRANSFER_PROGRESS = 'transfer progress',
  BACKUP_STARTED = 'backup started',
  BACKUP_PROGRESS = 'backup progress',
  BACKUP_COMPLETED = 'backup completed',
  BACKUP_RESTORE_STARTED = 'backup restore started',
  BACKUP_RESTORE_PROGRESS = 'backup restore progress',
  BACKUP_RESTORE_COMPLETED = 'backup restore completed',
  SCHEDULE_STARTED = 'schedule started',
  SCHEDULE_STEP_STATUS = 'schedule step status',
  SCHEDULE_STEP_ERROR = 'schedule step error',
  SCHEDULE_COMPLETED = 'schedule status',
  OPERATION_PROGRESS = 'operation progress',
  OPERATION_COMPLETED = 'operation completed',
  OPERATION_ERROR = 'operation error',
}

export enum SocketRequest {
  CONFIGURE_SOCKET = 'configure socket',
  SEND_LOGS = 'send logs',
  SEND_STATS = 'send stats',
  SEND_STATUS = 'send status',
  SEND_COMMAND = 'send command',
  SET_STATE = 'set state',
  PING = 'ping',
}

const useWebsocketEvent = (event: SocketEvent, callback: (...data: string[]) => void) => {
  const { socketInstance } = useServerStore();
  const savedCallback = useRef<(...data: string[]) => void>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  return useEffect(() => {
    const eventListener = (...data: string[]) => savedCallback.current!(...data);
    if (socketInstance) {
      socketInstance.addListener(event, eventListener);
    }

    return () => {
      if (socketInstance) {
        socketInstance.removeListener(event, eventListener);
      }
    };
  }, [event, socketInstance]);
};

export default useWebsocketEvent;
