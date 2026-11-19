import { faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteAllocation from '@/api/server/allocations/deleteAllocation.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function AllocationActionBar({
  selectedAllocations,
  clearSelection,
  onFinished,
}: {
  selectedAllocations: ObjectSet<z.infer<typeof serverAllocationSchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const removable = selectedAllocations.values().filter((allocation) => !allocation.isPrimary);
  const skippedRemovals = selectedAllocations.size - removable.length;

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doRemove = () => {
    setConfirming(false);

    run({
      action: 'remove',
      items: removable,
      itemKey: 'serverAllocation',
      verb: t('common.bulkActions.verb.removed', {}),
      skipped: skippedRemovals,
      request: (allocation) => deleteAllocation(server.uuid, allocation.uuid),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title={t('pages.server.network.modal.removeAllocations.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        <Stack>
          {t('pages.server.network.modal.removeAllocations.content', {
            allocations: tItem('serverAllocation', removable.length),
          }).md()}

          {skippedRemovals > 0 && (
            <Alert color='yellow' icon={faTriangleExclamation}>
              {t('pages.server.network.modal.removeAllocations.alert.skipped', {
                allocations: tItem('serverAllocation', skippedRemovals),
              })}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedAllocations.size > 0}>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.network.actionBar.prependedComponents}
          name='network-actionBar-prepended'
        />

        <ServerCan action='allocations.delete'>
          <Button
            color='red'
            onClick={() => setConfirming(true)}
            loading={loading === 'remove'}
            disabled={removable.length === 0}
          >
            <FontAwesomeIcon icon={faTrash} className='mr-2' />
            {t('common.button.remove', {})} ({removable.length})
          </Button>
        </ServerCan>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.network.actionBar.appendedComponents}
          name='network-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
