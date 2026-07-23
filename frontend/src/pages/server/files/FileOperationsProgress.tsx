import { faPause, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import cancelOperation from '@/api/server/files/cancelOperation.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Popover from '@/elements/Popover.tsx';
import Progress from '@/elements/Progress.tsx';
import RingProgress from '@/elements/RingProgress.tsx';
import Text from '@/elements/Text.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import UnstyledButton from '@/elements/UnstyledButton.tsx';
import { bytesProgressString } from '@/lib/size.ts';
import { canResumeInSession, pauseUpload, resumeDetachedUpload, resumeUpload } from '@/lib/uploadManager.ts';
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
  const {
    uploadingFiles,
    cancelFileUpload,
    cancelFolderUpload,
    cancelAllUploads,
    aggregatedUploadProgress,
    invalidateFilemanager,
  } = useFileManager(
    useShallow((state) => ({
      uploadingFiles: state.fileUploader.uploadingFiles,
      cancelFileUpload: state.fileUploader.cancelFileUpload,
      cancelFolderUpload: state.fileUploader.cancelFolderUpload,
      cancelAllUploads: state.fileUploader.cancelAllUploads,
      aggregatedUploadProgress: state.fileUploader.aggregatedUploadProgress,
      invalidateFilemanager: state.invalidateFilemanager,
    })),
  );

  const [openModal, setOpenModal] = useState<'cancelUploads' | 'cancelOperations' | null>(null);

  const reselectInputRef = useRef<HTMLInputElement | null>(null);
  const reselectKeyRef = useRef<string | null>(null);

  const isRateLimited = useMemo(() => {
    for (const file of uploadingFiles.values()) {
      if (file.retryAttempt > 0 && file.status === 'uploading') return true;
    }
    return false;
  }, [uploadingFiles]);

  const hasUploadErrors = useMemo(() => {
    for (const file of uploadingFiles.values()) {
      if (file.status === 'error') return true;
    }
    return false;
  }, [uploadingFiles]);

  const cancelAllOperations = useCallback(() => {
    const cancellations: Promise<unknown>[] = [];
    fileOperations.forEach((_, uuid) => {
      removeFileOperation(uuid);
      cancellations.push(cancelOperation(server.uuid, uuid).catch(console.error));
    });
    Promise.allSettled(cancellations).then(() => invalidateFilemanager());
    addToast(t('pages.server.files.toast.allOperationsCancelled', {}), 'success');
  }, [fileOperations, server.uuid, removeFileOperation, invalidateFilemanager, addToast, t]);

  const doCancelOperation = (uuid: string) => {
    removeFileOperation(uuid);

    cancelOperation(server.uuid, uuid)
      .then(() => {
        invalidateFilemanager();
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
    <Popover position='bottom-start' shadow='md'>
      <Popover.Target>
        <UnstyledButton>
          <RingProgress
            size={50}
            sections={[
              {
                value: averageOperationProgress,
                color: hasUploadErrors ? 'red' : isRateLimited ? 'orange' : uploadingFiles.size > 0 ? 'green' : 'blue',
              },
            ]}
            roundCaps
            thickness={4}
            label={
              <Text
                c={hasUploadErrors ? 'red' : isRateLimited ? 'orange' : uploadingFiles.size > 0 ? 'green' : 'blue'}
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
            {t('elements.fileUpload.rateLimited', {})}
          </Text>
        )}

        <ConfirmationModal
          title={t('elements.fileUpload.modal.cancelAllUploads.title', {})}
          opened={openModal === 'cancelUploads'}
          onClose={() => setOpenModal(null)}
          onConfirmed={() => {
            setOpenModal(null);
            cancelAllUploads();
          }}
          confirm={t('elements.fileUpload.cancelAllUploads', {})}
          zIndex={1000}
        >
          {t('elements.fileUpload.modal.cancelAllUploads.content', {})}
        </ConfirmationModal>

        <ConfirmationModal
          title={t('pages.server.files.modal.cancelAllOperations.title', {})}
          opened={openModal === 'cancelOperations'}
          onClose={() => setOpenModal(null)}
          onConfirmed={() => {
            setOpenModal(null);
            cancelAllOperations();
          }}
          confirm={t('pages.server.files.operations.cancelAllOperations', {})}
          zIndex={1000}
        >
          {t('pages.server.files.modal.cancelAllOperations.content', {})}
        </ConfirmationModal>

        <div className='flex gap-2 mb-3'>
          {uploadingFiles.size > 0 && (
            <Button size='xs' variant='subtle' color='red' onClick={() => setOpenModal('cancelUploads')}>
              {t('elements.fileUpload.cancelAllUploads', {})}
            </Button>
          )}
          {fileOperations.size > 0 && (
            <Button size='xs' variant='subtle' color='red' onClick={() => setOpenModal('cancelOperations')}>
              {t('pages.server.files.operations.cancelAllOperations', {})}
            </Button>
          )}
        </div>

        {Array.from(aggregatedUploadProgress).map(([folderName, info]) => {
          const progress = info.totalSize > 0 ? (info.uploadedSize / info.totalSize) * 100 : 0;
          const failed = info.erroredCount > 0 && info.activeCount === 0;
          const statusText = failed
            ? t('elements.fileUpload.failedFolder', {
                folder: folderName,
                files: tItem('file', info.erroredCount),
              })
            : t('elements.fileUpload.uploadingFolder', {
                folder: folderName,
                files: tItem('file', info.fileCount),
              });

          return (
            <div key={folderName} className='flex flex-row items-center mb-3'>
              <div className='flex flex-col grow'>
                <p className='break-all mb-1'>{statusText}</p>
                <Tooltip label={bytesProgressString(info.uploadedSize, info.totalSize)} innerClassName='w-full'>
                  <Progress
                    indeterminate={info.totalSize === 0}
                    value={progress}
                    color={info.erroredCount > 0 ? 'red' : isRateLimited ? 'orange' : undefined}
                  />
                </Tooltip>
              </div>
              <Tooltip label={t('elements.fileUpload.cancel', {})}>
                <ActionIcon variant='light' color='red' className='ml-3' onClick={() => cancelFolderUpload(folderName)}>
                  <FontAwesomeIcon icon={faXmark} size='sm' />
                </ActionIcon>
              </Tooltip>
            </div>
          );
        })}

        {Array.from(uploadingFiles).map(([key, file]) => {
          if (aggregatedUploadProgress.size > 0 && file.filePath.includes('/')) {
            return null;
          }

          if (file.status === 'paused') {
            const inSession = canResumeInSession(key);

            return (
              <div key={key} className='flex flex-row items-center mb-2'>
                <div className='flex flex-col grow'>
                  <div className='flex items-center gap-2 mb-1'>
                    <Badge variant='light' color='yellow' size='sm'>
                      {t('elements.fileUpload.badge.paused', {})}
                    </Badge>
                    <span className='break-all text-sm'>{file.filePath}</span>
                  </div>
                  {inSession ? (
                    <Tooltip label={bytesProgressString(file.uploaded, file.size)} innerClassName='w-full'>
                      <Progress value={file.progress} color='gray' />
                    </Tooltip>
                  ) : (
                    <Button
                      size='compact-xs'
                      variant='light'
                      leftSection={<FontAwesomeIcon icon={faPlay} size='sm' />}
                      onClick={() => {
                        reselectKeyRef.current = key;
                        reselectInputRef.current?.click();
                      }}
                    >
                      {t('elements.fileUpload.reselect', {})}
                    </Button>
                  )}
                </div>
                <div className='flex items-center gap-1 ml-3'>
                  {inSession && (
                    <Tooltip label={t('elements.fileUpload.resume', {})}>
                      <ActionIcon variant='light' onClick={() => resumeUpload(key)}>
                        <FontAwesomeIcon icon={faPlay} size='sm' />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  <Tooltip label={t('elements.fileUpload.cancel', {})}>
                    <ActionIcon variant='light' color='red' onClick={() => cancelFileUpload(key)}>
                      <FontAwesomeIcon icon={faXmark} size='sm' />
                    </ActionIcon>
                  </Tooltip>
                </div>
              </div>
            );
          }

          const canPause = file.resumable && file.status === 'uploading';

          return (
            <div key={key} className='flex flex-row items-center mb-2'>
              <div className='flex flex-col grow'>
                <div className='flex items-center gap-2 mb-1'>
                  <Badge
                    variant='light'
                    size='sm'
                    color={
                      file.status === 'error'
                        ? 'red'
                        : file.status === 'pending'
                          ? 'gray'
                          : isRateLimited
                            ? 'orange'
                            : 'blue'
                    }
                  >
                    {file.status === 'error'
                      ? t('elements.fileUpload.badge.failed', {})
                      : file.status === 'pending'
                        ? t('elements.fileUpload.badge.waiting', {})
                        : t('elements.fileUpload.badge.uploading', {})}
                  </Badge>
                  <span className='break-all text-sm'>{file.filePath}</span>
                </div>
                <Tooltip label={bytesProgressString(file.uploaded, file.size)} innerClassName='w-full'>
                  <Progress
                    value={file.progress}
                    color={file.status === 'error' ? 'red' : isRateLimited ? 'orange' : undefined}
                  />
                </Tooltip>
              </div>
              <div className='flex items-center gap-1 ml-3'>
                {canPause && (
                  <Tooltip label={t('elements.fileUpload.pause', {})}>
                    <ActionIcon variant='light' onClick={() => pauseUpload(key)}>
                      <FontAwesomeIcon icon={faPause} size='sm' />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label={t('elements.fileUpload.cancel', {})}>
                  <ActionIcon variant='light' color='red' onClick={() => cancelFileUpload(key)}>
                    <FontAwesomeIcon icon={faXmark} size='sm' />
                  </ActionIcon>
                </Tooltip>
              </div>
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
                              : operation.type === 'export_backup'
                                ? t('pages.server.files.operations.exportingBackup', {
                                    destination: operation.destinationPath,
                                  })
                                : null}
                </p>
                <Tooltip
                  label={`${bytesProgressString(operation.bytesProcessed, operation.bytesTotal)}${
                    operation.type === 'compress' ||
                    operation.type === 'copy' ||
                    operation.type === 'copy_remote' ||
                    operation.type === 'copy_many'
                      ? ` · ${tItem('file', operation.filesProcessed)}`
                      : ''
                  }`}
                  innerClassName='w-full'
                >
                  <Progress indeterminate={!operation.bytesTotal} value={progress} />
                </Tooltip>
              </div>
              <Tooltip label={t('common.button.cancel', {})}>
                <ActionIcon variant='light' color='red' className='ml-3' onClick={() => doCancelOperation(uuid)}>
                  <FontAwesomeIcon icon={faXmark} size='sm' />
                </ActionIcon>
              </Tooltip>
            </div>
          );
        })}

        {window.extensionContext.extensionRegistry.pages.server.files.fileOperationsProgress.appendedComponents.map(
          (Component, i) => (
            <Component key={`files-operationProgress-appended-${i}`} />
          ),
        )}

        <input
          ref={reselectInputRef}
          type='file'
          className='hidden'
          onChange={(event) => {
            const key = reselectKeyRef.current;
            const file = event.target.files?.[0];
            reselectKeyRef.current = null;
            event.target.value = '';
            if (key && file) resumeDetachedUpload(key, file);
          }}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

export default memo(FileOperationsProgress);
