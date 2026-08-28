import { useShallow } from 'zustand/react/shallow';
import { queryKeys } from '@/lib/queryKeys.ts';
import useWebsocketEvent, { SocketEvent } from '@/plugins/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import useInvalidateServerCache from './useInvalidateServerCache.ts';

export default function useServerBackupSocket() {
  const serverStoreApi = useServerStoreApi();
  const { t } = useTranslations();
  const { addToast } = useToast();
  const invalidateCacheKey = useInvalidateServerCache();
  const { updateServer, setBackupProgress, clearBackupProgress, setBackupRestoreProgress, updateBackup, removeBackup } =
    useServerStore(
      useShallow((state) => ({
        updateServer: state.updateServer,
        setBackupProgress: state.setBackupProgress,
        clearBackupProgress: state.clearBackupProgress,
        setBackupRestoreProgress: state.setBackupRestoreProgress,
        updateBackup: state.updateBackup,
        removeBackup: state.removeBackup,
      })),
    );

  useWebsocketEvent(SocketEvent.BACKUP_PROGRESS, (uuid, data) => {
    let wsData: { bytes_processed: number; bytes_total: number; files_processed: number };
    try {
      wsData = JSON.parse(data);
    } catch {
      return;
    }

    setBackupProgress(uuid, {
      progress: wsData.bytes_processed,
      total: wsData.bytes_total,
      files: wsData.files_processed,
    });
  });

  useWebsocketEvent(SocketEvent.BACKUP_COMPLETED, (uuid, data) => {
    let wsData: {
      successful: boolean;
      checksum_type: string;
      checksum: string;
      size: number;
      files: number;
      browsable: boolean;
      streaming: boolean;
    };
    try {
      wsData = JSON.parse(data);
    } catch {
      return;
    }

    if (wsData.successful) {
      addToast(t('elements.serverWebsocket.listener.toast.backupCompleted', {}), 'success');
    } else {
      addToast(t('elements.serverWebsocket.listener.toast.backupFailed', {}), 'error');
    }

    clearBackupProgress(uuid);

    updateBackup(uuid, {
      isSuccessful: wsData.successful,
      checksum: `${wsData.checksum_type}:${wsData.checksum}`,
      bytes: wsData.size,
      files: wsData.files,
      isBrowsable: wsData.browsable,
      isStreaming: wsData.streaming,
      completed: new Date(),
    });
    invalidateCacheKey(queryKeys.server(serverStoreApi.getState().server.uuid).backups.groups.all());
    invalidateCacheKey(queryKeys.server(serverStoreApi.getState().server.uuid).backups.system());
  });

  useWebsocketEvent(SocketEvent.BACKUP_DELETED, (uuid, data) => {
    let wsData: { successful: boolean };
    try {
      wsData = JSON.parse(data);
    } catch {
      return;
    }

    if (wsData.successful) {
      removeBackup(uuid);
    } else {
      addToast(t('elements.serverWebsocket.listener.toast.backupDeleteFailed', {}), 'error');
      updateBackup(uuid, { deletionStatus: 'failed' });
    }

    invalidateCacheKey(queryKeys.server(serverStoreApi.getState().server.uuid).backups.groups.all());
    invalidateCacheKey(queryKeys.server(serverStoreApi.getState().server.uuid).backups.system());
  });

  useWebsocketEvent(SocketEvent.BACKUP_RESTORE_STARTED, () => {
    updateServer({ status: 'restoring_backup' });
  });

  useWebsocketEvent(SocketEvent.BACKUP_RESTORE_PROGRESS, (data) => {
    let wsData: { bytes_processed: number; bytes_total: number; files_processed: number };
    try {
      wsData = JSON.parse(data);
    } catch {
      return;
    }

    setBackupRestoreProgress(wsData.bytes_processed, wsData.bytes_total, wsData.files_processed);
  });

  useWebsocketEvent(SocketEvent.BACKUP_RESTORE_COMPLETED, (successful) => {
    const failed = successful === 'false';

    updateServer({ status: failed ? 'backup_restore_failed' : null });

    addToast(
      failed
        ? t('elements.serverWebsocket.listener.toast.backupRestoreFailed', {})
        : t('elements.serverWebsocket.listener.toast.backupRestoreCompleted', {}),
      failed ? 'error' : 'success',
    );
  });
}
