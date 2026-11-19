import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import Alert from '@/elements/feedback/Alert.tsx';
import { formatMilliseconds } from '@/lib/format/time.ts';
import { WebsocketStatus } from '@/plugins/websocket/useWebsocket.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DatabaseInstanceConnectionBanner({
  status,
  nextRetryMs,
  reconnectAttempt,
}: {
  status: WebsocketStatus;
  nextRetryMs: number | null;
  reconnectAttempt: number;
}) {
  const { t } = useTranslations();
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!nextRetryMs) {
      setCountdown(null);
      return;
    }

    let remaining = Math.ceil(nextRetryMs / 1000);
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
  }, [nextRetryMs, reconnectAttempt]);

  if (status !== 'reconnecting') {
    return null;
  }

  const parts = [t('pages.server.databases.instance.view.connectionLost', {})];
  if (countdown !== null && countdown > 0) {
    parts.push(t('elements.serverWebsocket.banner.retrying', { countdown: formatMilliseconds(countdown * 1000) }));
  }

  return (
    <Alert icon={faExclamationTriangle} color='yellow'>
      {parts.join(' ')}
    </Alert>
  );
}
