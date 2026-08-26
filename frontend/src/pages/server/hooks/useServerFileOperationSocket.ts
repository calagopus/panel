import { ReactNode } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import { serverFileOperationSchema } from '@/lib/schemas/server/files.ts';
import { formatMilliseconds } from '@/lib/time.ts';
import { transformKeysToCamelCase } from '@/lib/transformers.ts';
import useWebsocketEvent, { SocketEvent } from '@/plugins/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import useInvalidateServerCache from './useInvalidateServerCache.ts';

type TFunc = ReturnType<typeof useTranslations>['t'];
type TItemFunc = ReturnType<typeof useTranslations>['tItem'];
type FileOperation = z.infer<typeof serverFileOperationSchema>;
type FileOperationToastPhase = 'completed' | 'aborted' | 'error';

// Shared by OPERATION_COMPLETED/OPERATION_ABORTED/OPERATION_ERROR below - the translation key
// (and which extra param it takes) differs per phase, but the per-type field mapping is the same.
function getFileOperationToastMessage(
  t: TFunc,
  tItem: TItemFunc,
  fileOperation: FileOperation,
  server: { uuid: string },
  phase: FileOperationToastPhase,
  extra: { time?: string; error?: string },
): ReactNode {
  switch (fileOperation.type) {
    case 'compress':
      if (phase === 'completed') {
        return t('elements.serverWebsocket.listener.toast.operations.compressing.completed', {
          files: tItem('file', fileOperation.filesProcessed),
          path: fileOperation.path,
          time: extra.time!,
        }).md();
      } else if (phase === 'aborted') {
        return t('elements.serverWebsocket.listener.toast.operations.compressing.aborted', {
          files: tItem('file', fileOperation.filesProcessed),
          path: fileOperation.path,
        }).md();
      } else {
        return t('elements.serverWebsocket.listener.toast.operations.compressing.failed', {
          files: tItem('file', fileOperation.filesProcessed),
          path: fileOperation.path,
          error: extra.error!,
        }).md();
      }
    case 'decompress':
      if (phase === 'completed') {
        return t('elements.serverWebsocket.listener.toast.operations.decompressing.completed', {
          path: fileOperation.path,
          destination: fileOperation.destinationPath || '/',
          time: extra.time!,
        }).md();
      } else if (phase === 'aborted') {
        return t('elements.serverWebsocket.listener.toast.operations.decompressing.aborted', {
          path: fileOperation.path,
          destination: fileOperation.destinationPath || '/',
        }).md();
      } else {
        return t('elements.serverWebsocket.listener.toast.operations.decompressing.failed', {
          path: fileOperation.path,
          destination: fileOperation.destinationPath || '/',
          error: extra.error!,
        }).md();
      }
    case 'pull':
      if (phase === 'completed') {
        return t('elements.serverWebsocket.listener.toast.operations.pulling.completed', {
          destination: fileOperation.destinationPath,
          time: extra.time!,
        }).md();
      } else if (phase === 'aborted') {
        return t('elements.serverWebsocket.listener.toast.operations.pulling.aborted', {
          destination: fileOperation.destinationPath,
        }).md();
      } else {
        return t('elements.serverWebsocket.listener.toast.operations.pulling.failed', {
          destination: fileOperation.destinationPath,
          error: extra.error!,
        }).md();
      }
    case 'copy':
      if (phase === 'completed') {
        return (
          fileOperation.filesProcessed > 1
            ? t('elements.serverWebsocket.listener.toast.operations.copying.completedMany', {
                path: fileOperation.path,
                destination: fileOperation.destinationPath,
                files: tItem('file', fileOperation.filesProcessed),
                time: extra.time!,
              })
            : t('elements.serverWebsocket.listener.toast.operations.copying.completed', {
                path: fileOperation.path,
                destination: fileOperation.destinationPath,
                time: extra.time!,
              })
        ).md();
      } else if (phase === 'aborted') {
        return t('elements.serverWebsocket.listener.toast.operations.copying.aborted', {
          path: fileOperation.path,
          destination: fileOperation.destinationPath,
        }).md();
      } else {
        return t('elements.serverWebsocket.listener.toast.operations.copying.failed', {
          path: fileOperation.path,
          destination: fileOperation.destinationPath,
          error: extra.error!,
        }).md();
      }
    case 'copy_many':
      if (phase === 'completed') {
        return t('elements.serverWebsocket.listener.toast.operations.copyingMany.completed', {
          files: tItem('file', fileOperation.filesProcessed),
          time: extra.time!,
        }).md();
      } else if (phase === 'aborted') {
        return t('elements.serverWebsocket.listener.toast.operations.copyingMany.aborted', {
          files: tItem('file', fileOperation.filesProcessed),
        }).md();
      } else {
        return t('elements.serverWebsocket.listener.toast.operations.copyingMany.failed', {
          files: tItem('file', fileOperation.filesProcessed),
          error: extra.error!,
        }).md();
      }
    case 'copy_remote': {
      const isFrom = fileOperation.destinationServer === server.uuid;
      if (phase === 'completed') {
        return (
          isFrom
            ? t('elements.serverWebsocket.listener.toast.operations.copyingRemote.completedFrom', {
                files: tItem('file', fileOperation.filesProcessed),
                time: extra.time!,
              })
            : t('elements.serverWebsocket.listener.toast.operations.copyingRemote.completedTo', {
                files: tItem('file', fileOperation.filesProcessed),
                time: extra.time!,
              })
        ).md();
      } else if (phase === 'aborted') {
        return (
          isFrom
            ? t('elements.serverWebsocket.listener.toast.operations.copyingRemote.abortedFrom', {
                files: tItem('file', fileOperation.filesProcessed),
              })
            : t('elements.serverWebsocket.listener.toast.operations.copyingRemote.abortedTo', {
                files: tItem('file', fileOperation.filesProcessed),
              })
        ).md();
      } else {
        return (
          isFrom
            ? t('elements.serverWebsocket.listener.toast.operations.copyingRemote.failedFrom', {
                files: tItem('file', fileOperation.filesProcessed),
                error: extra.error!,
              })
            : t('elements.serverWebsocket.listener.toast.operations.copyingRemote.failedTo', {
                files: tItem('file', fileOperation.filesProcessed),
                error: extra.error!,
              })
        ).md();
      }
    }
    case 'export_backup':
      if (phase === 'completed') {
        return t('elements.serverWebsocket.listener.toast.operations.exportingBackup.completed', {
          destination: fileOperation.destinationPath,
          time: extra.time!,
        }).md();
      } else if (phase === 'aborted') {
        return t('elements.serverWebsocket.listener.toast.operations.exportingBackup.aborted', {
          destination: fileOperation.destinationPath,
        }).md();
      } else {
        return t('elements.serverWebsocket.listener.toast.operations.exportingBackup.failed', {
          destination: fileOperation.destinationPath,
          error: extra.error!,
        }).md();
      }
    default:
      fileOperation satisfies never;
      return null;
  }
}

export default function useServerFileOperationSocket() {
  const serverStoreApi = useServerStoreApi();
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const invalidateCacheKey = useInvalidateServerCache();
  const { setFileOperation, failFileOperation, removeFileOperation } = useServerStore(
    useShallow((state) => ({
      setFileOperation: state.setFileOperation,
      failFileOperation: state.failFileOperation,
      removeFileOperation: state.removeFileOperation,
    })),
  );

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

    addToast(
      getFileOperationToastMessage(t, tItem, fileOperation, server, 'completed', { time: totalTime }),
      'success',
    );

    invalidateCacheKey(['server', server.uuid, 'files']);
    removeFileOperation(uuid);
  });

  useWebsocketEvent(SocketEvent.OPERATION_ABORTED, (uuid) => {
    const { server, fileOperations } = serverStoreApi.getState();
    const fileOperation = fileOperations.get(uuid);
    if (!fileOperation) return;

    addToast(getFileOperationToastMessage(t, tItem, fileOperation, server, 'aborted', {}), 'error');

    invalidateCacheKey(['server', server.uuid, 'files']);
    failFileOperation(uuid);
  });

  useWebsocketEvent(SocketEvent.OPERATION_ERROR, (uuid, error) => {
    const { server, fileOperations } = serverStoreApi.getState();
    const fileOperation = fileOperations.get(uuid);
    if (!fileOperation) return;

    addToast(getFileOperationToastMessage(t, tItem, fileOperation, server, 'error', { error }), 'error');

    failFileOperation(uuid);
  });
}
