import { QueryFilters, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import getServer from '@/api/server/getServer.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverFileOperationSchema } from '@/lib/schemas/server/files.ts';
import { serverImagePullProgressSchema, serverResourceUsageSchema } from '@/lib/schemas/server/server.ts';
import { formatMilliseconds } from '@/lib/time.ts';
import { transformKeysToCamelCase } from '@/lib/transformers.ts';
import useWebsocketEvent, { SocketEvent, SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import { useUserStore } from '@/stores/user.ts';

export default function WebsocketListener() {
  const serverStoreApi = useServerStoreApi();
  const queryClient = useQueryClient();
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const addServerResourceUsage = useUserStore((state) => state.addServerResourceUsage);
  const socketConnected = useServerStore((state) => state.socketConnected);
  const socketInstance = useServerStore((state) => state.socketInstance);
  const {
    updateServer,
    setSocketConnectionState,
    setSocketError,
    setImagePull,
    removeImagePull,
    clearImagePulls,
    setPendingRestart,
    setStats,
    setBackupProgress,
    clearBackupProgress,
    setBackupRestoreProgress,
    setTransferProgress,
    updateBackup,
    setRunningScheduleStep,
    setScheduleSteps,
    setFileOperation,
    removeFileOperation,
  } = useServerStore(
    useShallow((state) => ({
      updateServer: state.updateServer,
      setSocketConnectionState: state.setSocketConnectionState,
      setSocketError: state.setSocketError,
      setImagePull: state.setImagePull,
      removeImagePull: state.removeImagePull,
      clearImagePulls: state.clearImagePulls,
      setPendingRestart: state.setPendingRestart,
      setStats: state.setStats,
      setBackupProgress: state.setBackupProgress,
      clearBackupProgress: state.clearBackupProgress,
      setBackupRestoreProgress: state.setBackupRestoreProgress,
      setTransferProgress: state.setTransferProgress,
      updateBackup: state.updateBackup,
      setRunningScheduleStep: state.setRunningScheduleStep,
      setScheduleSteps: state.setScheduleSteps,
      setFileOperation: state.setFileOperation,
      removeFileOperation: state.removeFileOperation,
    })),
  );

  const transferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (transferTimeoutRef.current !== null) clearTimeout(transferTimeoutRef.current);
    };
  }, []);

  const invalidateCacheKey = (queryKey: QueryFilters['queryKey']) => {
    queryClient
      .invalidateQueries({
        queryKey,
      })
      .catch((e) => console.error(e));
  };

  useEffect(() => {
    return () => {
      clearImagePulls();
    };
  }, [clearImagePulls]);

  useEffect(() => {
    if (!socketConnected || !socketInstance) {
      return;
    }

    socketInstance.send(SocketRequest.SEND_STATS);
  }, [socketInstance, socketConnected]);

  useWebsocketEvent(SocketEvent.STATS, (data) => {
    let resourceUsage: z.infer<typeof serverResourceUsageSchema>;
    try {
      resourceUsage = transformKeysToCamelCase(JSON.parse(data)) as z.infer<typeof serverResourceUsageSchema>;
    } catch {
      return;
    }

    setStats(resourceUsage);
    addServerResourceUsage(serverStoreApi.getState().server.uuid, resourceUsage);
  });

  useWebsocketEvent(SocketEvent.PENDING_RESTART, (pending) => {
    setPendingRestart(pending === 'true');
  });

  useWebsocketEvent(SocketEvent.IMAGE_PULL_PROGRESS, (id, data) => {
    let wsData: z.infer<typeof serverImagePullProgressSchema>;
    try {
      wsData = JSON.parse(data);
    } catch {
      return;
    }

    setImagePull(id, wsData);
  });

  useWebsocketEvent(SocketEvent.IMAGE_PULL_COMPLETED, (id) => {
    removeImagePull(id);
  });

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

    // Ungrouped backups live in the store; grouped backups live in component-local
    // state fed by react-query, so refetch the groups to reflect the completed backup.
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

  useWebsocketEvent(SocketEvent.BACKUP_RESTORE_COMPLETED, () => {
    updateServer({ status: null });

    addToast(t('elements.serverWebsocket.listener.toast.backupRestoreCompleted', {}), 'success');
  });

  useWebsocketEvent(SocketEvent.TRANSFER_STATUS, (s) => {
    if (s === 'processing') {
      updateServer({ isTransferring: true });
    } else if (s === 'completed') {
      if (socketInstance) {
        socketInstance.close();
        setSocketConnectionState(false);
        setSocketError(null);
      }
      if (transferTimeoutRef.current !== null) clearTimeout(transferTimeoutRef.current);
      transferTimeoutRef.current = setTimeout(() => {
        transferTimeoutRef.current = null;
        getServer(serverStoreApi.getState().server.uuid)
          .then((data) => {
            updateServer(data);
            updateServer({ isTransferring: false });
          })
          .catch((e) => console.error(e));
      }, 5000);
    }
  });

  useWebsocketEvent(SocketEvent.TRANSFER_PROGRESS, (data) => {
    updateServer({ isTransferring: true });

    let wsData: {
      archive_bytes_processed: number;
      network_bytes_processed: number;
      bytes_total: number;
      files_processed: number;
    };
    try {
      wsData = JSON.parse(data);
    } catch {
      return;
    }

    setTransferProgress(
      wsData.archive_bytes_processed,
      wsData.network_bytes_processed,
      wsData.bytes_total,
      wsData.files_processed,
    );
  });

  useWebsocketEvent(SocketEvent.INSTALL_STARTED, () => {
    updateServer({ status: 'installing' });
  });

  useWebsocketEvent(SocketEvent.INSTALL_COMPLETED, (successful) => {
    updateServer({ status: successful === 'true' ? null : 'install_failed' });

    if (successful === 'true') {
      addToast(t('elements.serverWebsocket.listener.toast.installCompleted', {}), 'success');
    } else {
      addToast(t('elements.serverWebsocket.listener.toast.installFailed', {}), 'error');
    }
  });

  useWebsocketEvent(SocketEvent.SCHEDULE_STARTED, (uuid) => {
    const { schedule, scheduleSteps } = serverStoreApi.getState();
    if (schedule?.uuid === uuid) {
      setScheduleSteps(scheduleSteps.map((s) => ({ ...s, error: null })));
    }
  });

  useWebsocketEvent(SocketEvent.SCHEDULE_STEP_STATUS, (uuid, stepUuid) => {
    setRunningScheduleStep(uuid, stepUuid);
  });

  useWebsocketEvent(SocketEvent.SCHEDULE_STEP_ERROR, (uuid, stepUuid, error) => {
    const { schedule, scheduleSteps } = serverStoreApi.getState();
    if (schedule?.uuid === uuid) {
      setScheduleSteps(scheduleSteps.map((s) => (s.uuid === stepUuid ? { ...s, error } : s)));
    }
  });

  useWebsocketEvent(SocketEvent.SCHEDULE_COMPLETED, (uuid) => {
    setRunningScheduleStep(uuid, null);
  });

  useWebsocketEvent(SocketEvent.OPERATION_PROGRESS, (uuid, data) => {
    let wsData: z.infer<typeof serverFileOperationSchema>;
    try {
      wsData = transformKeysToCamelCase(JSON.parse(data)) as z.infer<typeof serverFileOperationSchema>;
    } catch {
      return;
    }

    setFileOperation(uuid, wsData);
  });

  useWebsocketEvent(SocketEvent.OPERATION_COMPLETED, (uuid) => {
    const { server, fileOperations } = serverStoreApi.getState();
    const fileOperation = fileOperations.get(uuid);
    if (!fileOperation) return;

    const totalTime = formatMilliseconds(Math.max(0, Date.now() - new Date(fileOperation.startTime).getTime()), false);

    switch (fileOperation.type) {
      case 'compress':
        addToast(
          t('elements.serverWebsocket.listener.toast.operations.compressing.completed', {
            files: tItem('file', fileOperation.filesProcessed),
            path: fileOperation.path,
            time: totalTime,
          }).md(),
          'success',
        );

        break;
      case 'decompress':
        addToast(
          t('elements.serverWebsocket.listener.toast.operations.decompressing.completed', {
            path: fileOperation.path,
            destination: fileOperation.destinationPath || '/',
            time: totalTime,
          }).md(),
          'success',
        );

        break;
      case 'pull':
        addToast(
          t('elements.serverWebsocket.listener.toast.operations.pulling.completed', {
            destination: fileOperation.destinationPath,
            time: totalTime,
          }).md(),
          'success',
        );

        break;
      case 'copy':
        addToast(
          (fileOperation.filesProcessed > 1
            ? t('elements.serverWebsocket.listener.toast.operations.copying.completedMany', {
                path: fileOperation.path,
                destination: fileOperation.destinationPath,
                files: tItem('file', fileOperation.filesProcessed),
                time: totalTime,
              })
            : t('elements.serverWebsocket.listener.toast.operations.copying.completed', {
                path: fileOperation.path,
                destination: fileOperation.destinationPath,
                time: totalTime,
              })
          ).md(),
          'success',
        );

        break;
      case 'copy_many':
        addToast(
          t('elements.serverWebsocket.listener.toast.operations.copyingMany.completed', {
            files: tItem('file', fileOperation.filesProcessed),
            time: totalTime,
          }).md(),
          'success',
        );

        break;
      case 'copy_remote':
        if (fileOperation.destinationServer === server.uuid) {
          addToast(
            t('elements.serverWebsocket.listener.toast.operations.copyingRemote.completedFrom', {
              files: tItem('file', fileOperation.filesProcessed),
              time: totalTime,
            }).md(),
            'success',
          );
        } else {
          addToast(
            t('elements.serverWebsocket.listener.toast.operations.copyingRemote.completedTo', {
              files: tItem('file', fileOperation.filesProcessed),
              time: totalTime,
            }).md(),
            'success',
          );
        }

        break;
      default:
        break;
    }

    invalidateCacheKey(['server', server.uuid, 'files']);
    removeFileOperation(uuid);
  });

  useWebsocketEvent(SocketEvent.OPERATION_ERROR, (uuid, error) => {
    const { server, fileOperations } = serverStoreApi.getState();
    const fileOperation = fileOperations.get(uuid);
    if (!fileOperation) return;

    switch (fileOperation.type) {
      case 'compress':
        addToast(
          t('elements.serverWebsocket.listener.toast.operations.compressing.failed', {
            files: tItem('file', fileOperation.filesProcessed),
            path: fileOperation.path,
            error,
          }).md(),
          'error',
        );

        break;
      case 'decompress':
        addToast(
          t('elements.serverWebsocket.listener.toast.operations.decompressing.failed', {
            path: fileOperation.path,
            destination: fileOperation.destinationPath || '/',
            error,
          }).md(),
          'error',
        );

        break;
      case 'pull':
        addToast(
          t('elements.serverWebsocket.listener.toast.operations.pulling.failed', {
            destination: fileOperation.destinationPath,
            error,
          }).md(),
          'error',
        );

        break;
      case 'copy':
        addToast(
          t('elements.serverWebsocket.listener.toast.operations.copying.failed', {
            path: fileOperation.path,
            destination: fileOperation.destinationPath,
            error,
          }).md(),
          'error',
        );

        break;
      case 'copy_many':
        addToast(
          t('elements.serverWebsocket.listener.toast.operations.copyingMany.failed', {
            files: tItem('file', fileOperation.filesProcessed),
            error,
          }).md(),
          'error',
        );

        break;
      case 'copy_remote':
        if (fileOperation.destinationServer === server.uuid) {
          addToast(
            t('elements.serverWebsocket.listener.toast.operations.copyingRemote.failedFrom', {
              files: tItem('file', fileOperation.filesProcessed),
              error,
            }).md(),
            'error',
          );
        } else {
          addToast(
            t('elements.serverWebsocket.listener.toast.operations.copyingRemote.failedTo', {
              files: tItem('file', fileOperation.filesProcessed),
              error,
            }).md(),
            'error',
          );
        }

        break;
      default:
        break;
    }

    removeFileOperation(uuid);
  });

  return null;
}
