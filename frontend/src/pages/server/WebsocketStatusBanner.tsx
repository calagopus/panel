import { faExclamationTriangle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import Alert from '@/elements/Alert.tsx';
import { formatMilliseconds } from '@/lib/time.ts';
import { SocketErrorType } from '@/plugins/Websocket.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function WebsocketStatusBanner() {
  const { t } = useTranslations();
  const socketError = useServerStore((state) => state.socketError);
  const serverIsTransferring = useServerStore((state) => state.server.isTransferring);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!socketError?.nextRetryMs) {
      setCountdown(null);
      return;
    }

    let remaining = Math.ceil(socketError.nextRetryMs / 1000);
    setCountdown(remaining);

    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setCountdown(null);
      } else {
        setCountdown(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [socketError?.nextRetryMs, socketError?.reconnectAttempt]);

  if (!socketError) {
    return null;
  }

  const isRecoverable = socketError.recoverable;

  const getMessage = () => {
    switch (socketError.type) {
      case SocketErrorType.PERMISSION_DENIED:
        if (serverIsTransferring) {
          return null;
        }
        return socketError.message;

      case SocketErrorType.AUTH_FAILED:
      case SocketErrorType.DAEMON_ERROR:
        return socketError.message;

      case SocketErrorType.CONNECTION_LOST:
      case SocketErrorType.CONNECTION_FAILED:
      default: {
        if (!isRecoverable) {
          return socketError.message;
        }

        const parts = [socketError.message];
        if (countdown !== null && countdown > 0) {
          parts.push(
            t('elements.serverWebsocket.banner.retrying', {
              countdown: formatMilliseconds(countdown * 1000),
            }),
          );
        }
        return parts.join(' ');
      }
    }
  };

  const message = getMessage();

  if (!message) {
    return null;
  }

  return (
    <Alert
      icon={<FontAwesomeIcon icon={isRecoverable ? faExclamationTriangle : faTimesCircle} />}
      color={isRecoverable ? 'yellow' : 'red'}
      className='mt-2 mx-2 mb-4'
    >
      {message}
    </Alert>
  );
}
