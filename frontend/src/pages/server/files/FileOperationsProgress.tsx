import { memo, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import cancelOperation from '@/api/server/files/cancelOperation.ts';
import Button from '@/elements/Button.tsx';
import CloseButton from '@/elements/CloseButton.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Popover from '@/elements/Popover.tsx';
import Progress from '@/elements/Progress.tsx';
import RingProgress from '@/elements/RingProgress.tsx';
import Text from '@/elements/Text.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import UnstyledButton from '@/elements/UnstyledButton.tsx';
import { bytesToString } from '@/lib/size.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useToast } from '@/providers/contexts/toastContext.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

function FileOperationsProgress() {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const { server, fileOperations, removeFileOperation } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      fileOperations: state.fileOperations,
      removeFileOperation: state.removeFileOperation,
    })),
  );
  const { uploadingFiles, cancelFileUpload, cancelFolderUpload, cancelAllUploads, aggregatedUploadProgress } =
    useFileManager(
      useShallow((state) => ({
        uploadingFiles: state.fileUploader.uploadingFiles,
        cancelFileUpload: state.fileUploader.cancelFileUpload,
        cancelFolderUpload: state.fileUploader.cancelFolderUpload,
        cancelAllUploads: state.fileUploader.cancelAllUploads,
        aggregatedUploadProgress: state.fileUploader.aggregatedUploadProgress,
      })),
    );

  const blocker = useBlocker(uploadingFiles.size > 0, true);

  const isRateLimited = useMemo(() => {
    for (const file of uploadingFiles.values()) {
      if (file.retryAttempt > 0 && file.status === 'uploading') return true;
    }
    return false;
  }, [uploadingFiles]);

  const cancelAllOperations = useCallback(() => {
    fileOperations.forEach((_, uuid) => {
      removeFileOperation(uuid);
      cancelOperation(server.uuid, uuid).catch(console.error);
    });
    addToast(t('pages.server.files.toast.allOperationsCancelled', {}), 'success');
  }, [fileOperations, server.uuid, removeFileOperation, addToast, t]);

  const doCancelOperation = (uuid: string) => {
    removeFileOperation(uuid);

    cancelOperation(server.uuid, uuid)
      .then(() => {
        addToast(t('pages.server.files.toast.operationCancelled', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const hasOperations = fileOperations.size > 0 || uploadingFiles.size > 0;

  const averageOperationProgress = useMemo(() => {
    if (fileOperations.size === 0 && uploadingFiles.size === 0) {
      return 0;
    }

    let totalProgress = 0;
    let totalSize = 0;

    fileOperations.forEach((operation) => {
      if (operation.bytesTotal === 0) return;
      totalProgress += operation.bytesProcessed;
      totalSize += operation.bytesTotal;
    });

    uploadingFiles.forEach((file) => {
      totalProgress += file.uploaded;
      totalSize += file.size;
    });

    return totalSize > 0 ? (totalProgress / totalSize) * 100 : 0;
  }, [fileOperations, uploadingFiles]);

  if (!hasOperations) return null;

  return (
    <>
      <ConfirmationModal
        title={t('pages.server.files.modal.activeUploads.title', {})}
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset()}
        onConfirmed={() => blocker.proceed()}
        confirm={t('common.button.leavePage', {})}
      >
        {t('pages.server.files.modal.activeUploads.content', { files: tItem('file', uploadingFiles.size) }).md()}
      </ConfirmationModal>

      <Popover position='bottom-start' shadow='md'>
        <Popover.Target>
          <UnstyledButton>
            <RingProgress
              size={50}
              sections={[
                {
                  value: averageOperationProgress,
                  color: isRateLimited ? 'orange' : uploadingFiles.size > 0 ? 'green' : 'blue',
                },
              ]}
              roundCaps
              thickness={4}
              label={
                <Text
                  c={isRateLimited ? 'orange' : uploadingFiles.size > 0 ? 'green' : 'blue'}
                  fw={700}
                  ta='center'
                  size='xs'
                >
                  {averageOperationProgress.toFixed(0)}%
                </Text>
              }
            />
          </UnstyledButton>
        </Popover.Target>
        <Popover.Dropdown className='md:min-w-xl max-w-screen max-h-96 overflow-y-auto'>
          {window.extensionContext.extensionRegistry.pages.server.files.fileOperationsProgress.prependedComponents.map(
            (Component, i) => (
              <Component key={`files-operationProgress-prepended-${i}`} />
            ),
          )}

          {isRateLimited && (
            <Text size='xs' c='orange' mb='sm'>
              {t('pages.server.files.operations.rateLimited', {})}
            </Text>
          )}

          <div className='flex gap-2 mb-3'>
            {uploadingFiles.size > 0 && (
              <Button size='xs' variant='subtle' color='red' onClick={cancelAllUploads}>
                {t('pages.server.files.operations.cancelAllUploads', {})}
              </Button>
            )}
            {fileOperations.size > 0 && (
              <Button size='xs' variant='subtle' color='red' onClick={cancelAllOperations}>
                {t('pages.server.files.operations.cancelAllOperations', {})}
              </Button>
            )}
          </div>

          {Array.from(aggregatedUploadProgress).map(([folderName, info]) => {
            const progress = info.totalSize > 0 ? (info.uploadedSize / info.totalSize) * 100 : 0;
            const statusText = t('pages.server.files.operations.uploadingFolder', {
              folder: folderName,
              files: tItem('file', info.fileCount),
            });

            return (
              <div key={folderName} className='flex flex-row items-center mb-3'>
                <div className='flex flex-col grow'>
                  <p className='break-all mb-1'>{statusText}</p>
                  <Tooltip
                    label={`${bytesToString(info.uploadedSize)} / ${bytesToString(info.totalSize)}`}
                    innerClassName='w-full'
                  >
                    <Progress value={progress} color={isRateLimited ? 'orange' : undefined} />
                  </Tooltip>
                </div>
                <CloseButton className='ml-3' onClick={() => cancelFolderUpload(folderName)} />
              </div>
            );
          })}

          {Array.from(uploadingFiles).map(([key, file]) => {
            if (aggregatedUploadProgress.size > 0 && file.filePath.includes('/')) {
              return null;
            }

            return (
              <div key={key} className='flex flex-row items-center mb-2'>
                <div className='flex flex-col grow'>
                  <p className='break-all mb-1 text-sm'>
                    {file.status === 'pending'
                      ? t('pages.server.files.operations.waiting', {})
                      : t('pages.server.files.operations.uploading', {})}
                    {file.filePath}
                  </p>
                  <Tooltip
                    label={`${bytesToString(file.uploaded)} / ${bytesToString(file.size)}`}
                    innerClassName='w-full'
                  >
                    <Progress value={file.progress} color={isRateLimited ? 'orange' : undefined} />
                  </Tooltip>
                </div>
                <CloseButton className='ml-3' onClick={() => cancelFileUpload(key)} />
              </div>
            );
          })}

          {Array.from(fileOperations).map(([uuid, operation]) => {
            const progress = (operation.bytesProcessed / operation.bytesTotal) * 100;

            return (
              <div key={uuid} className='flex flex-row items-center mb-2'>
                <div className='flex flex-col grow'>
                  <p className='break-all mb-1'>
                    {operation.type === 'compress'
                      ? t('pages.server.files.operations.compressing', {
                          files: tItem('file', operation.files.length),
                          path: operation.path,
                        })
                      : operation.type === 'decompress'
                        ? t('pages.server.files.operations.decompressing', { path: operation.path })
                        : operation.type === 'pull'
                          ? t('pages.server.files.operations.pulling', { destination: operation.destinationPath })
                          : operation.type === 'copy'
                            ? t('pages.server.files.operations.copying', {
                                path: operation.path,
                                destination: operation.destinationPath,
                              })
                            : operation.type === 'copy_many'
                              ? t('pages.server.files.operations.copyingMany', {
                                  files: tItem('file', operation.files.length),
                                })
                              : operation.type === 'copy_remote'
                                ? operation.destinationServer === server.uuid
                                  ? t('pages.server.files.operations.receivingRemote', {
                                      files: tItem('file', operation.files.length),
                                    })
                                  : t('pages.server.files.operations.sendingRemote', {
                                      files: tItem('file', operation.files.length),
                                    })
                                : null}
                  </p>
                  <Tooltip
                    label={`${bytesToString(operation.bytesProcessed)} / ${bytesToString(operation.bytesTotal)}${
                      operation.type === 'compress' ||
                      operation.type === 'copy' ||
                      operation.type === 'copy_remote' ||
                      operation.type === 'copy_many'
                        ? ` · ${tItem('file', operation.filesProcessed)}`
                        : ''
                    }`}
                    innerClassName='w-full'
                  >
                    <Progress value={progress} />
                  </Tooltip>
                </div>
                <CloseButton className='ml-3' onClick={() => doCancelOperation(uuid)} />
              </div>
            );
          })}

          {window.extensionContext.extensionRegistry.pages.server.files.fileOperationsProgress.appendedComponents.map(
            (Component, i) => (
              <Component key={`files-operationProgress-appended-${i}`} />
            ),
          )}
        </Popover.Dropdown>
      </Popover>
    </>
  );
}

export default memo(FileOperationsProgress);
