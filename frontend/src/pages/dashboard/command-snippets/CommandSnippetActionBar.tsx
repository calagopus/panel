import { faClipboard, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteCommandSnippet from '@/api/me/command-snippets/deleteCommandSnippet.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { userCommandSnippetSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function CommandSnippetActionBar({
  selectedCommandSnippets,
  clearSelection,
  onFinished,
}: {
  selectedCommandSnippets: ObjectSet<z.infer<typeof userCommandSnippetSchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const commandSnippets = selectedCommandSnippets.values();

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doDelete = () => {
    setConfirming(false);

    run({
      action: 'delete',
      items: commandSnippets,
      itemKey: 'commandSnippet',
      verb: t('common.bulkActions.verb.deleted', {}),
      request: (commandSnippet) => deleteCommandSnippet(commandSnippet.uuid),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title={t('pages.account.commandSnippets.modal.deleteCommandSnippets.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('common.modal.deleteFromAccount.content', {
            name: tItem('commandSnippet', commandSnippets.length),
          }).md()}

          <ItemPreviewList
            items={commandSnippets}
            getKey={(commandSnippet) => commandSnippet.uuid}
            renderItem={(commandSnippet) => (
              <ItemPreviewRow
                icon={<FontAwesomeIcon icon={faClipboard} />}
                name={`!${commandSnippet.name}`}
                description={commandSnippet.command}
              />
            )}
          />
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedCommandSnippets.size > 0}>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.dashboard.commandSnippets.actionBar.prependedComponents
          }
          name='commandSnippets-actionBar-prepended'
        />

        <Button color='red' onClick={() => setConfirming(true)} loading={loading === 'delete'}>
          <FontAwesomeIcon icon={faTrash} className='mr-2' />
          {t('common.button.delete', {})} ({commandSnippets.length})
        </Button>

        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.dashboard.commandSnippets.actionBar.appendedComponents
          }
          name='commandSnippets-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
