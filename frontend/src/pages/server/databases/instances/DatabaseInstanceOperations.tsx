import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteDatabaseInstanceOperation from '@/api/server/databases/instances/deleteDatabaseInstanceOperation.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import FailedOperationProgress from '@/elements/FailedOperationProgress.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Popover from '@/elements/Popover.tsx';
import Progress from '@/elements/Progress.tsx';
import RingProgress from '@/elements/RingProgress.tsx';
import Text from '@/elements/Text.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import UnstyledButton from '@/elements/UnstyledButton.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceOperationSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { bytesToString } from '@/lib/size.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { FAILED_DATABASE_INSTANCE_OPERATION_LINGER_MS } from '@/stores/slices/server/databaseInstances.ts';

export default function DatabaseInstanceOperations() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { server, instance, operations, failedOperations, removeOperation } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      instance: state.databaseInstance,
      operations: state.databaseInstanceOperations,
      failedOperations: state.failedDatabaseInstanceOperations,
      removeOperation: state.removeDatabaseInstanceOperation,
    })),
  );

  const canCancel = useServerCan('database-instances.import');

  const [cancelAllOpen, setCancelAllOpen] = useState(false);

  if (!instance || operations.size === 0) return null;

  const invalidateDatabases = () => {
    queryClient
      .invalidateQueries({ queryKey: queryKeys.server(server.uuid).databases.instances.databases(instance.uuid) })
      .catch(console.error);
  };

  const doCancelOperation = (uuid: string) => {
    deleteDatabaseInstanceOperation(server.uuid, instance.uuid, uuid)
      .then(() => {
        invalidateDatabases();
        addToast(t('pages.server.databases.instance.toast.operationCancelled', {}), 'success');
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  };

  const cancelAllOperations = () => {
    const cancellations: Promise<unknown>[] = [];

    operations.forEach((_, uuid) => {
      if (failedOperations.has(uuid)) {
        removeOperation(uuid);
        return;
      }

      cancellations.push(deleteDatabaseInstanceOperation(server.uuid, instance.uuid, uuid).catch(console.error));
    });

    Promise.allSettled(cancellations).then(() => invalidateDatabases());
    addToast(t('pages.server.databases.instance.toast.allOperationsCancelled', {}), 'success');
  };

  const operationLabel = (operation: z.infer<typeof serverDatabaseInstanceOperationSchema>) => {
    switch (operation.type) {
      case 'remote_import':
        return t('pages.server.databases.instance.operations.remoteImport', {
          source: operation.sourceDb ? `${operation.sourceHost}/${operation.sourceDb}` : operation.sourceHost,
          database: operation.db ?? instance.name,
        });
    }
  };

  const hasErrors = failedOperations.size > 0;

  return (
    <Popover position='bottom-end' shadow='md'>
      <Popover.Target>
        <UnstyledButton>
          <RingProgress
            size={50}
            indeterminate
            sections={[{ value: 0, color: hasErrors ? 'red' : 'blue' }]}
            roundCaps
            thickness={4}
            label={
              <Text c={hasErrors ? 'red' : 'blue'} fw={700} ta='center' size='xs'>
                {operations.size}
              </Text>
            }
          />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown className='md:min-w-xl max-w-screen max-h-96 overflow-y-auto'>
        <ConfirmationModal
          title={t('pages.server.databases.instance.modal.cancelAllOperations.title', {})}
          opened={cancelAllOpen}
          onClose={() => setCancelAllOpen(false)}
          onConfirmed={() => {
            setCancelAllOpen(false);
            cancelAllOperations();
          }}
          confirm={t('pages.server.databases.instance.operations.cancelAllOperations', {})}
          zIndex={1000}
        >
          {t('pages.server.databases.instance.modal.cancelAllOperations.content', {})}
        </ConfirmationModal>

        {canCancel && (
          <div className='flex gap-2 mb-3'>
            <Button size='xs' variant='subtle' color='red' onClick={() => setCancelAllOpen(true)}>
              {t('pages.server.databases.instance.operations.cancelAllOperations', {})}
            </Button>
          </div>
        )}

        {Array.from(operations).map(([uuid, operation]) => {
          const failedAt = failedOperations.get(uuid);

          return (
            <div key={uuid} className='flex flex-row items-center mb-2'>
              <div className='flex flex-col grow'>
                <p className='break-all mb-1'>{operationLabel(operation)}</p>
                {failedAt === undefined ? (
                  <Tooltip label={bytesToString(operation.bytesProcessed)} innerClassName='w-full'>
                    <Progress indeterminate />
                  </Tooltip>
                ) : (
                  <FailedOperationProgress
                    failedAt={failedAt}
                    lingerMs={FAILED_DATABASE_INSTANCE_OPERATION_LINGER_MS}
                  />
                )}
              </div>
              {(failedAt !== undefined || canCancel) && (
                <Tooltip label={failedAt === undefined ? t('common.button.cancel', {}) : t('common.button.close', {})}>
                  <ActionIcon
                    variant='light'
                    color='red'
                    className='ml-3'
                    onClick={() => (failedAt === undefined ? doCancelOperation(uuid) : removeOperation(uuid))}
                  >
                    <FontAwesomeIcon icon={faXmark} size='sm' />
                  </ActionIcon>
                </Tooltip>
              )}
            </div>
          );
        })}
      </Popover.Dropdown>
    </Popover>
  );
}
