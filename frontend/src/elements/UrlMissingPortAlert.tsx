import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import { urlIsMissingPort } from '@/lib/network/url.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function UrlMissingPortAlert({
  url,
  defaultPort,
  onAddPort,
  children,
}: {
  url: string;
  defaultPort: number;
  onAddPort?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslations();

  if (!urlIsMissingPort(url)) {
    return null;
  }

  return (
    <Alert color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
      <div className='flex flex-col items-start gap-2'>
        {children}
        {onAddPort && (
          <Button size='compact-xs' variant='light' color='yellow' onClick={onAddPort}>
            {t('common.button.addDefaultPort', { port: String(defaultPort) })}
          </Button>
        )}
      </div>
    </Alert>
  );
}
