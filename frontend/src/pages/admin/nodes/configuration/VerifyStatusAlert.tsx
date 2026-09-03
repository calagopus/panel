import { faCheck, faCircleQuestion, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode } from 'react';
import Alert from '@/elements/feedback/Alert.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type VerifyResult = { ok: true; version: string } | { ok: false; error: string };

export default function VerifyStatusAlert({
  title,
  result,
  renderError,
}: {
  title: string;
  result: VerifyResult | null;
  renderError: (error: string) => ReactNode;
}) {
  const { t } = useTranslations();

  return (
    <Alert
      color={result ? (result.ok ? 'green' : 'red') : 'gray'}
      icon={<FontAwesomeIcon icon={result ? (result.ok ? faCheck : faExclamationTriangle) : faCircleQuestion} />}
      title={title}
    >
      {!result
        ? t('pages.admin.nodes.tabs.configuration.page.alert.verifyNotTested', {})
        : result.ok
          ? t('pages.admin.nodes.tabs.configuration.page.alert.verifySuccess', { version: result.version })
          : renderError(result.error)}
    </Alert>
  );
}
