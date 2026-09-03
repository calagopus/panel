import { faExclamationTriangle, faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ExtensionStatus } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Code from '@/elements/typography/Code.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ExtensionStatusAlerts({
  extensionStatus,
  supervisor,
  buildFailed,
  failureReason,
  pendingRestart,
  isBuilding,
  onRestart,
}: {
  extensionStatus: ExtensionStatus | undefined;
  supervisor: ExtensionStatus['supervisor'];
  buildFailed: boolean;
  failureReason: string | null;
  pendingRestart: boolean;
  isBuilding: boolean;
  onRestart: () => void;
}) {
  const { t } = useTranslations();

  return (
    <>
      {extensionStatus && !supervisor && (
        <Alert
          color='red'
          icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          title={t('pages.admin.extensions.alert.supervisorUnreachable.title', {})}
          mb='md'
        >
          {t('pages.admin.extensions.alert.supervisorUnreachable.content', {})}
        </Alert>
      )}

      {buildFailed && (
        <Alert
          color='red'
          icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          title={t('pages.admin.extensions.alert.buildFailed.title', {})}
          mb='md'
        >
          <div className='flex flex-col items-start gap-2'>
            {failureReason && <Code>{failureReason}</Code>}
            <span>{t('pages.admin.extensions.alert.buildFailed.content', {})}</span>
          </div>
        </Alert>
      )}

      {pendingRestart && (
        <Alert
          color='yellow'
          icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          title={t('pages.admin.extensions.alert.pendingRestart.title', {})}
          mb='md'
        >
          <div className='flex flex-col items-start gap-2'>
            <span>{t('pages.admin.extensions.alert.pendingRestart.content', {})}</span>
            {supervisor && (
              <AdminCan action='extensions.manage'>
                <Button
                  variant='default'
                  leftSection={<FontAwesomeIcon icon={faPowerOff} />}
                  disabled={isBuilding}
                  onClick={onRestart}
                >
                  {t('pages.admin.extensions.button.restart', {})}
                </Button>
              </AdminCan>
            )}
          </div>
        </Alert>
      )}
    </>
  );
}
