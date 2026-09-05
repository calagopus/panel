import { useEffect, useMemo, useRef } from 'react';
import EstimatedTimeArrival from '@/elements/time/EstimatedTimeArrival.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bytesProgressString } from '@/lib/format/size.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type ServerStatusToastKind = 'transfer' | 'restore' | 'install';

export default function ServerStatusToast() {
  const { t, tItem } = useTranslations();
  const { addProgressToast, updateToast, dismissToast } = useToast();

  const kind = useServerStore((state): ServerStatusToastKind | null =>
    state.server.isTransferring
      ? 'transfer'
      : state.server.status === 'restoring_backup'
        ? 'restore'
        : state.server.status === 'installing'
          ? 'install'
          : null,
  );

  const transferProgress = useServerStore((state) => state.transferProgressArchive);
  const transferTotal = useServerStore((state) => state.transferProgressTotal);
  const transferFiles = useServerStore((state) => state.transferProgressFiles);
  const restoreProgress = useServerStore((state) => state.backupRestoreProgress);
  const restoreTotal = useServerStore((state) => state.backupRestoreTotal);
  const restoreFiles = useServerStore((state) => state.backupRestoreFiles);
  const installProgress = useServerStore((state) => state.installProgress);

  const progress = useMemo(() => {
    switch (kind) {
      case 'transfer':
        return transferTotal > 0 ? (transferProgress / transferTotal) * 100 : null;
      case 'restore':
        return restoreTotal > 0 ? (restoreProgress / restoreTotal) * 100 : null;
      case 'install':
        if (!installProgress) return null;

        return installProgress.total === 100
          ? installProgress.progress
          : installProgress.total > 0
            ? (installProgress.progress / installProgress.total) * 100
            : null;
      default:
        return null;
    }
  }, [kind, transferProgress, transferTotal, restoreProgress, restoreTotal, installProgress]);

  const { message, messageKey } = useMemo(() => {
    switch (kind) {
      case 'transfer': {
        const details = `${bytesProgressString(transferProgress, transferTotal)} · ${tItem('file', transferFiles)}`;

        return {
          messageKey: `transfer:${details}`,
          message: (
            <>
              {t('pages.server.console.notification.transferring', {})}
              <Text size='xs' c='dimmed'>
                {details}
              </Text>
              <EstimatedTimeArrival className='text-xs' progress={transferProgress} total={transferTotal} />
            </>
          ),
        };
      }
      case 'restore': {
        const details = `${bytesProgressString(restoreProgress, restoreTotal)} · ${tItem('file', restoreFiles)}`;

        return {
          messageKey: `restore:${details}`,
          message: (
            <>
              {t('pages.server.console.notification.restoringBackup', {})}
              <Text size='xs' c='dimmed'>
                {details}
              </Text>
              <EstimatedTimeArrival className='text-xs' progress={restoreProgress} total={restoreTotal} />
            </>
          ),
        };
      }
      case 'install':
        return {
          messageKey: `install:${installProgress?.label ?? ''}`,
          message: (
            <>
              {t('pages.server.console.notification.installing', {})}
              {installProgress?.label ? (
                <Text size='xs' c='dimmed'>
                  {installProgress.label}
                </Text>
              ) : null}
            </>
          ),
        };
      default:
        return { messageKey: '', message: null };
    }
  }, [
    kind,
    transferProgress,
    transferTotal,
    transferFiles,
    restoreProgress,
    restoreTotal,
    restoreFiles,
    installProgress,
    t,
    tItem,
  ]);

  const toastId = useRef<number | null>(null);
  const toastMessageKey = useRef<string | null>(null);

  useEffect(() => {
    if (!kind) return;

    const id = addProgressToast(message);
    toastId.current = id;
    toastMessageKey.current = messageKey;

    return () => {
      dismissToast(id);
      toastId.current = null;
      toastMessageKey.current = null;
    };
  }, [kind]);

  useEffect(() => {
    if (toastId.current === null) return;

    updateToast(toastId.current, {
      message: toastMessageKey.current === messageKey ? undefined : message,
      progress,
    });
    toastMessageKey.current = messageKey;
  }, [messageKey, progress]);

  return null;
}
