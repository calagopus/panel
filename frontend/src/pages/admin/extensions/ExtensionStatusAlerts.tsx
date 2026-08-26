import { faExclamationTriangle, faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ExtensionStatus } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface ExtensionBuildStatus {
  buildFailed: boolean;
  failureReason: string | null;
}

export interface ExtensionRestartState {
  pendingRestart: boolean;
  isBuilding: boolean;
  onRestart: () => void;
}

export default function ExtensionStatusAlerts({
  extensionStatus,
  supervisor,
  buildStatus,
  restart,
}: {
  extensionStatus: ExtensionStatus | undefined;
  supervisor: ExtensionStatus['supervisor'];
  buildStatus: ExtensionBuildStatus;
  restart: ExtensionRestartState;
}) {
  const { t } = useTranslations();
  const { buildFailed, failureReason } = buildStatus;
  const { pendingRestart, isBuilding, onRestart: handleRestart } = restart;

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
                  onClick={handleRestart}
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
