import { faKey, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteSshKey from '@/api/me/ssh-keys/deleteSshKey.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SshKeyActionBar({
  selectedSshKeys,
  clearSelection,
  onFinished,
}: {
  selectedSshKeys: ObjectSet<z.infer<typeof userSshKeySchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const sshKeys = selectedSshKeys.values();

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doDelete = () => {
    setConfirming(false);

    run({
      action: 'delete',
      items: sshKeys,
      itemKey: 'sshKey',
      verb: t('common.bulkActions.verb.deleted', {}),
      request: (sshKey) => deleteSshKey(sshKey.uuid),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title={t('pages.account.sshKeys.modal.deleteSshKeys.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('common.modal.deleteFromAccount.content', { name: tItem('sshKey', sshKeys.length) }).md()}

          <ItemPreviewList
            items={sshKeys}
            getKey={(sshKey) => sshKey.uuid}
            renderItem={(sshKey) => (
              <ItemPreviewRow
                icon={<FontAwesomeIcon icon={faKey} />}
                name={sshKey.name}
                description={sshKey.fingerprint}
              />
            )}
          />
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedSshKeys.size > 0}>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.dashboard.sshKeys.actionBar.prependedComponents}
          name='sshKeys-actionBar-prepended'
        />

        <Button color='red' onClick={() => setConfirming(true)} loading={loading === 'delete'}>
          <FontAwesomeIcon icon={faTrash} className='mr-2' />
          {t('common.button.delete', {})} ({sshKeys.length})
        </Button>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.dashboard.sshKeys.actionBar.appendedComponents}
          name='sshKeys-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
