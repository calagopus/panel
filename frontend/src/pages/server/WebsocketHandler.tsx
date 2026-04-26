import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import getWebsocketToken from '@/api/server/getWebsocketToken.ts';
import { SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { SocketError, SocketErrorType, Websocket } from '@/plugins/Websocket.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const MAX_TOKEN_REFRESH_FAILURES = 3;

export default function WebsocketHandler() {
  const uuid = useServerStore((state) => state.server.uuid);
  const isTransferring = useServerStore((state) => state.server.isTransferring);
  const nodeMaintenanceEnabled = useServerStore((state) => state.server.nodeMaintenanceEnabled);
  const { t } = useTranslations();
  const { setSocketInstance, setSocketConnectionState, setSocketError, setState } = useServerStore();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const socketRef = useRef<Websocket | null>(null);
  const connectingRef = useRef(false);
  const updatingTokenRef = useRef(false);
  const tokenRefreshFailuresRef = useRef(0);

  const uuidRef = useRef(uuid);
  uuidRef.current = uuid;

  const updateToken = (socket: Websocket) => {
    const currentUuid = uuidRef.current;
    if (updatingTokenRef.current || !currentUuid) {
      return;
    }

    if (tokenRefreshFailuresRef.current >= MAX_TOKEN_REFRESH_FAILURES) {
      console.error(
        `Websocket token refresh failed ${MAX_TOKEN_REFRESH_FAILURES} times consecutively. Aborting to prevent an infinite loop.`,
      );
      setSocketConnectionState(false);
      setSocketError({
        type: SocketErrorType.AUTH_FAILED,
        message: t('elements.serverWebsocket.error.tokenRefreshLoop', {}),
        recoverable: false,
        reconnectAttempt: 0,
        nextRetryMs: null,
      });
      return;
    }

    updatingTokenRef.current = true;
    getWebsocketToken(currentUuid)
      .then((data) => {
        if (socketRef.current === socket) {
          socket.setToken(data.token, true);
        }
      })
      .catch((error) => {
        console.error('Failed to refresh websocket token:', error);
        tokenRefreshFailuresRef.current += 1;
      })
      .finally(() => {
        updatingTokenRef.current = false;
      });
  };

  const connect = (uuid: string) => {
    if (connectingRef.current || socketRef.current) {
      return;
    }

    connectingRef.current = true;

    getWebsocketToken(uuid)
      .then((data) => {
        if (uuidRef.current !== uuid || socketRef.current) {
          return;
        }

        const socket = new Websocket();

        socket.on('auth success', () => {
          setSocketConnectionState(true);
          tokenRefreshFailuresRef.current = 0;
          socket.send(SocketRequest.CONFIGURE_SOCKET, ['transmission mode', 'binary']);
        });

        socket.on('SOCKET_RECONNECT', () => {
          setSocketConnectionState(false);
        });

        socket.on('SOCKET_CLOSE', () => {
          setSocketConnectionState(false);
        });

        socket.on('SOCKET_ERROR', () => {
          setSocketConnectionState(false);
        });

        socket.on('SOCKET_ERROR_STATE', (error: SocketError) => {
          setSocketError(error);

          if (error.type === SocketErrorType.PERMISSION_DENIED) {
            navigate('/');
            addToast(error.message, 'error');
          }
        });

        socket.on('SOCKET_ERROR_CLEAR', () => {
          setSocketError(null);
        });

        socket.on('SOCKET_MESSAGE', () => {
          setSocketError(null);
        });

        socket.on('status', (status) => setState(status));

        socket.on('daemon error', (message: string) => {
          console.warn('Got error message from daemon socket:', message);
          setSocketError({
            type: SocketErrorType.DAEMON_ERROR,
            message,
            recoverable: true,
            reconnectAttempt: 0,
            nextRetryMs: null,
          });
        });

        socket.on('token expiring', () => updateToken(socket));
        socket.on('token expired', () => {
          tokenRefreshFailuresRef.current += 1;
          updateToken(socket);
        });
        socket.on('jwt error', (error: string) => {
          setSocketConnectionState(false);
          console.warn('JWT validation error from wings:', error);

          setSocketError({
            type: SocketErrorType.AUTH_FAILED,
            message: t('elements.serverWebsocket.error.authFailed', { error }),
            recoverable: true,
            reconnectAttempt: 0,
            nextRetryMs: null,
          });

          updateToken(socket);
        });

        socket.setToken(data.token).setUseBinary(true).connect(data.socket);

        socketRef.current = socket;
        setSocketInstance(socket);
      })
      .catch((error) => {
        console.error('Failed to get initial websocket token:', error);
        setSocketError({
          type: SocketErrorType.CONNECTION_FAILED,
          message: t('elements.serverWebsocket.error.authRefreshFailed', {}),
          recoverable: false,
          reconnectAttempt: 0,
          nextRetryMs: null,
        });
      })
      .finally(() => {
        connectingRef.current = false;
      });
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        setSocketInstance(null);
        setSocketConnectionState(false);
        setSocketError(null);
      }
      connectingRef.current = false;
      updatingTokenRef.current = false;
      tokenRefreshFailuresRef.current = 0;
    };
  }, [uuid, isTransferring, nodeMaintenanceEnabled]);

  useEffect(() => {
    if (!uuid || socketRef.current || nodeMaintenanceEnabled) {
      return;
    }

    connect(uuid);
  }, [uuid, isTransferring, nodeMaintenanceEnabled]);

  return null;
}
