import { faBan, faCheck, faCloud, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteApiKey from '@/api/me/api-keys/deleteApiKey.ts';
import updateApiKey from '@/api/me/api-keys/updateApiKey.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ApiKeyActionBar({
  selectedApiKeys,
  clearSelection,
  onFinished,
}: {
  selectedApiKeys: ObjectSet<z.infer<typeof userApiKeySchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const apiKeys = selectedApiKeys.values();
  const disabledApiKeys = apiKeys.filter((apiKey) => !apiKey.enabled);
  const enabledApiKeys = apiKeys.filter((apiKey) => apiKey.enabled);

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doToggle = (enabled: boolean) => {
    const targets = enabled ? disabledApiKeys : enabledApiKeys;

    run({
      action: enabled ? 'enable' : 'disable',
      items: targets,
      itemKey: 'apiKey',
      verb: enabled ? t('common.bulkActions.verb.enabled', {}) : t('common.bulkActions.verb.disabled', {}),
      skipped: selectedApiKeys.size - targets.length,
      request: (apiKey) => updateApiKey(apiKey.uuid, { enabled }),
      onFinished: finish,
    });
  };

  const doDelete = () => {
    setConfirming(false);

    run({
      action: 'delete',
      items: apiKeys,
      itemKey: 'apiKey',
      verb: t('common.bulkActions.verb.deleted', {}),
      request: (apiKey) => deleteApiKey(apiKey.uuid),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title={t('pages.account.apiKeys.modal.deleteApiKeys.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('pages.account.apiKeys.modal.deleteApiKeys.content', {
            apiKeys: tItem('apiKey', apiKeys.length),
          }).md()}

          <ItemPreviewList
            items={apiKeys}
            getKey={(apiKey) => apiKey.uuid}
            renderItem={(apiKey) => (
              <ItemPreviewRow
                icon={<FontAwesomeIcon icon={faCloud} />}
                name={apiKey.name}
                description={`${apiKey.keyStart}...`}
              />
            )}
          />
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedApiKeys.size > 0}>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.dashboard.apiKeys.actionBar.prependedComponents}
          name='apiKeys-actionBar-prepended'
        />

        <Button
          color='green'
          onClick={() => doToggle(true)}
          loading={loading === 'enable'}
          disabled={disabledApiKeys.length === 0}
        >
          <FontAwesomeIcon icon={faCheck} className='mr-2' />
          {t('common.button.enable', {})} ({disabledApiKeys.length})
        </Button>

        <Button
          variant='default'
          onClick={() => doToggle(false)}
          loading={loading === 'disable'}
          disabled={enabledApiKeys.length === 0}
        >
          <FontAwesomeIcon icon={faBan} className='mr-2' />
          {t('common.button.disable', {})} ({enabledApiKeys.length})
        </Button>

        <Button color='red' onClick={() => setConfirming(true)} loading={loading === 'delete'}>
          <FontAwesomeIcon icon={faTrash} className='mr-2' />
          {t('common.button.delete', {})} ({apiKeys.length})
        </Button>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.dashboard.apiKeys.actionBar.appendedComponents}
          name='apiKeys-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
