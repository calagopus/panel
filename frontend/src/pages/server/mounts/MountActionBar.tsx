import { faMinus, faPlus, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import attachMount from '@/api/server/mounts/attachMount.ts';
import detachMount from '@/api/server/mounts/detachMount.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverMountSchema } from '@/lib/schemas/server/mounts.ts';
import { setMountAttached } from '@/pages/server/mounts/mountCache.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function MountActionBar({
  selectedMounts,
  clearSelection,
}: {
  selectedMounts: ObjectSet<z.infer<typeof serverMountSchema>, 'uuid'>;
  clearSelection: () => void;
}) {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();
  const { run, loading } = useBulkAction();

  const [confirmingDetach, setConfirmingDetach] = useState(false);

  const mounts = selectedMounts.values();
  const attachable = mounts.filter((mount) => !mount.created);
  const detachable = mounts.filter((mount) => mount.created);
  const skippedDetaches = selectedMounts.size - detachable.length;

  const doAttach = () =>
    run({
      action: 'attach',
      items: attachable,
      itemKey: 'mount',
      verb: t('common.bulkActions.verb.attached', {}),
      skipped: selectedMounts.size - attachable.length,
      request: (mount) =>
        attachMount(server.uuid, mount.uuid).then(() => setMountAttached(queryClient, server.uuid, mount.uuid, true)),
      onFinished: clearSelection,
    });

  const doDetach = () => {
    setConfirmingDetach(false);

    run({
      action: 'detach',
      items: detachable,
      itemKey: 'mount',
      verb: t('common.bulkActions.verb.detached', {}),
      skipped: skippedDetaches,
      request: (mount) =>
        detachMount(server.uuid, mount.uuid).then(() => setMountAttached(queryClient, server.uuid, mount.uuid, false)),
      onFinished: clearSelection,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirmingDetach}
        onClose={() => setConfirmingDetach(false)}
        title={t('pages.server.mounts.modal.detachMounts.title', {})}
        confirm={t('pages.server.mounts.button.detach', {})}
        onConfirmed={doDetach}
      >
        <Stack>
          {t('pages.server.mounts.modal.detachMounts.content', {
            mounts: tItem('mount', detachable.length),
          }).md()}

          {skippedDetaches > 0 && (
            <Alert color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              {t('pages.server.mounts.modal.detachMounts.alert.skipped', { mounts: tItem('mount', skippedDetaches) })}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedMounts.size > 0}>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.mounts.actionBar.prependedComponents}
          name='mounts-actionBar-prepended'
        />

        <ServerCan action='mounts.attach'>
          <Button color='green' onClick={doAttach} loading={loading === 'attach'} disabled={attachable.length === 0}>
            <FontAwesomeIcon icon={faPlus} className='mr-2' />
            {t('pages.server.mounts.button.attach', {})} ({attachable.length})
          </Button>
        </ServerCan>

        <ServerCan action='mounts.detach'>
          <Button
            color='red'
            onClick={() => setConfirmingDetach(true)}
            loading={loading === 'detach'}
            disabled={detachable.length === 0}
          >
            <FontAwesomeIcon icon={faMinus} className='mr-2' />
            {t('pages.server.mounts.button.detach', {})} ({detachable.length})
          </Button>
        </ServerCan>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.mounts.actionBar.appendedComponents}
          name='mounts-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
