import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteSubuser from '@/api/server/subusers/deleteSubuser.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverSubuserSchema } from '@/lib/schemas/server/subusers.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function SubuserActionBar({
  selectedSubusers,
  clearSelection,
  onFinished,
}: {
  selectedSubusers: ObjectSet<z.infer<typeof serverSubuserSchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const subusers = selectedSubusers.values();

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doRemove = () => {
    setConfirming(false);

    run({
      action: 'remove',
      items: subusers,
      itemKey: 'subuser',
      verb: t('common.bulkActions.verb.removed', {}),
      request: (subuser) => deleteSubuser(server.uuid, subuser.user.uuid),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title={t('pages.server.subusers.modal.removeSubusers.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('common.modal.removeFromServer.content', {
          name: tItem('subuser', subusers.length),
        }).md()}
      </ConfirmationModal>

      <ActionBar opened={selectedSubusers.size > 0}>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.subusers.actionBar.prependedComponents}
          name='subusers-actionBar-prepended'
        />

        <ServerCan action='subusers.delete'>
          <Button color='red' onClick={() => setConfirming(true)} loading={loading === 'remove'}>
            <FontAwesomeIcon icon={faTrash} className='mr-2' />
            {t('common.button.remove', {})} ({subusers.length})
          </Button>
        </ServerCan>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.subusers.actionBar.appendedComponents}
          name='subusers-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
