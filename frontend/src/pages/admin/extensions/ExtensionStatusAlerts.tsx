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
  failedExtensions,
  startFailedExtensions,
  pendingRestart,
  isBuilding,
  onRestart,
  restarting,
}: {
  extensionStatus: ExtensionStatus | undefined;
  supervisor: ExtensionStatus['supervisor'];
  buildFailed: boolean;
  failureReason: string | null;
  failedExtensions: string[];
  startFailedExtensions: Record<string, string>;
  pendingRestart: boolean;
  isBuilding: boolean;
  onRestart: () => void;
  restarting: boolean;
}) {
  const { t } = useTranslations();

  return (
    <>
      {extensionStatus && !supervisor && (
        <Alert
          color='red'
          icon={faExclamationTriangle}
          title={t('pages.admin.extensions.alert.supervisorUnreachable.title', {})}
          mb='md'
        >
          {t('pages.admin.extensions.alert.supervisorUnreachable.content', {})}
        </Alert>
      )}

      {extensionStatus && supervisor && extensionStatus.runningPanelVersion !== supervisor.panelVersion && (
        <Alert
          color='yellow'
          icon={faExclamationTriangle}
          title={t('pages.admin.extensions.alert.versionMismatch.title', {})}
          mb='md'
        >
          {t('pages.admin.extensions.alert.versionMismatch.content', {
            runningVersion: extensionStatus.runningPanelVersion,
            targetVersion: supervisor.panelVersion,
          })}
        </Alert>
      )}

      {buildFailed && (
        <Alert
          color='red'
          icon={faExclamationTriangle}
          title={t('pages.admin.extensions.alert.buildFailed.title', {})}
          mb='md'
        >
          <div className='flex flex-col items-start gap-2'>
            {failureReason && <Code>{failureReason}</Code>}
            {failedExtensions.length > 0 && (
              <span>
                {t('pages.admin.extensions.alert.buildFailed.failedExtensions', {
                  extensions: failedExtensions.map((packageName) => `\`${packageName}\``).join(', '),
                }).md()}
              </span>
            )}
            <span>{t('pages.admin.extensions.alert.buildFailed.content', {})}</span>
          </div>
        </Alert>
      )}

      {Object.keys(startFailedExtensions).length > 0 && (
        <Alert
          color='red'
          icon={faExclamationTriangle}
          title={t('pages.admin.extensions.alert.startFailed.title', {})}
          mb='md'
        >
          <div className='flex flex-col items-start gap-2'>
            <span>{t('pages.admin.extensions.alert.startFailed.content', {})}</span>
            {Object.entries(startFailedExtensions).map(([packageName, reason]) => (
              <div key={packageName} className='flex flex-col items-start gap-1'>
                <Code>{packageName}</Code>
                <Code block>{reason}</Code>
              </div>
            ))}
          </div>
        </Alert>
      )}

      {pendingRestart && (
        <Alert
          color='yellow'
          icon={faExclamationTriangle}
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
                  loading={restarting}
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
