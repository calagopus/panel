import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import cancelOperation from '@/api/server/files/cancelOperation.ts';
import Button from '@/elements/buttons/Button.tsx';
import UnstyledButton from '@/elements/buttons/UnstyledButton.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import RingProgress from '@/elements/feedback/RingProgress.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import Text from '@/elements/typography/Text.tsx';
import {
  computeAggregatedProgress,
  hasRetryingUpload,
  hasUploadError,
  resumeDetachedUpload,
} from '@/lib/files/uploadManager.ts';
import FileOperationRow from '@/pages/server/files/list/FileOperationRow.tsx';
import UploadFileRow from '@/pages/server/files/list/UploadFileRow.tsx';
import UploadFolderRow from '@/pages/server/files/list/UploadFolderRow.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/contexts/toastContext.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

function FileOperationsProgress() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, fileOperations, failedFileOperations, removeFileOperation } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      fileOperations: state.fileOperations,
      failedFileOperations: state.failedFileOperations,
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

  const canUpdate = useServerCan('files.update');

  const [openModal, setOpenModal] = useState<'cancelUploads' | 'cancelOperations' | null>(null);

  const reselectInputRef = useRef<HTMLInputElement | null>(null);
  const reselectKeyRef = useRef<string | null>(null);

  const isRateLimited = useMemo(() => hasRetryingUpload(uploadingFiles), [uploadingFiles]);

  const hasUploadErrors = useMemo(() => hasUploadError(uploadingFiles), [uploadingFiles]);

  const cancelAllOperations = useCallback(() => {
    const cancellations: Promise<unknown>[] = [];
    fileOperations.forEach((_, uuid) => {
      if (failedFileOperations.has(uuid)) {
        removeFileOperation(uuid);
        return;
      }

      cancellations.push(cancelOperation(server.uuid, uuid).catch(console.error));
    });
    Promise.allSettled(cancellations).then(() => invalidateFilemanager());
    addToast(t('pages.server.files.toast.allOperationsCancelled', {}), 'success');
  }, [fileOperations, failedFileOperations, server.uuid, removeFileOperation, invalidateFilemanager, addToast, t]);

  const doCancelOperation = (uuid: string) => {
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
  const hasErrors = hasUploadErrors || failedFileOperations.size > 0;

  const { averageOperationProgress, indeterminate } = useMemo(
    () => computeAggregatedProgress(fileOperations, uploadingFiles),
    [fileOperations, uploadingFiles],
  );

  if (!hasOperations) return null;

  return (
    <Popover position='bottom-start' shadow='md'>
      <Popover.Target>
        <UnstyledButton>
          <RingProgress
            size={50}
            indeterminate={indeterminate}
            sections={[
              {
                value: averageOperationProgress,
                color: hasErrors ? 'red' : isRateLimited ? 'orange' : uploadingFiles.size > 0 ? 'green' : 'blue',
              },
            ]}
            roundCaps
            thickness={4}
            label={
              <Text
                c={hasErrors ? 'red' : isRateLimited ? 'orange' : uploadingFiles.size > 0 ? 'green' : 'blue'}
                fw={700}
                ta='center'
                size='xs'
              >
                {indeterminate ? fileOperations.size + uploadingFiles.size : `${averageOperationProgress.toFixed(0)}%`}
              </Text>
            }
          />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown className='md:min-w-xl max-w-screen max-h-96 overflow-y-auto'>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.server.files.fileOperationsProgress.prependedComponents
          }
          name='files-operationProgress-prepended'
        />

        {isRateLimited && (
          <Text size='xs' c='orange' mb='sm'>
            {t('elements.fileUpload.rateLimited', {})}
          </Text>
        )}

        <ConfirmationModal
          title={t('elements.fileUpload.cancelAllUploads', {})}
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
          title={t('pages.server.files.operations.cancelAllOperations', {})}
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
          {fileOperations.size > 0 && canUpdate && (
            <Button size='xs' variant='subtle' color='red' onClick={() => setOpenModal('cancelOperations')}>
              {t('pages.server.files.operations.cancelAllOperations', {})}
            </Button>
          )}
        </div>

        {Array.from(aggregatedUploadProgress).map(([folderName, info]) => (
          <UploadFolderRow
            key={folderName}
            folderName={folderName}
            info={info}
            isRateLimited={isRateLimited}
            onCancel={() => cancelFolderUpload(folderName)}
          />
        ))}

        {Array.from(uploadingFiles).map(([key, file]) => {
          if (aggregatedUploadProgress.size > 0 && file.filePath.includes('/')) {
            return null;
          }

          return (
            <UploadFileRow
              key={key}
              fileKey={key}
              file={file}
              isRateLimited={isRateLimited}
              onCancel={() => cancelFileUpload(key)}
              onReselect={() => {
                reselectKeyRef.current = key;
                reselectInputRef.current?.click();
              }}
            />
          );
        })}

        {Array.from(fileOperations).map(([uuid, operation]) => (
          <FileOperationRow
            key={uuid}
            uuid={uuid}
            operation={operation}
            failedAt={failedFileOperations.get(uuid)}
            onCancel={doCancelOperation}
            onRemove={removeFileOperation}
          />
        ))}

        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.server.files.fileOperationsProgress.appendedComponents
          }
          name='files-operationProgress-appended'
        />

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
