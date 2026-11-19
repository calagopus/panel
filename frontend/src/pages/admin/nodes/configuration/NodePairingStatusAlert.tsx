import { faCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { OnlineWaitStatus } from '@/plugins/useOnlineWait.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodePairingStatusAlert({
  status,
  version,
}: {
  status: OnlineWaitStatus;
  version: string | null;
}) {
  const { t } = useTranslations();

  switch (status) {
    case 'idle':
      return null;
    case 'waiting':
      return (
        <Alert color='blue' icon={<Spinner size={16} />}>
          {t('pages.admin.nodes.pairing.status.waiting', {})}
        </Alert>
      );
    case 'connected':
      return (
        <Alert color='green' icon={faCheck}>
          {t('pages.admin.nodes.pairing.status.connected', { version: version ?? '' })}
        </Alert>
      );
    case 'timeout':
      return (
        <Alert color='yellow' icon={faExclamationTriangle}>
          {t('pages.admin.nodes.pairing.status.timeout', {})}
        </Alert>
      );
  }
}
