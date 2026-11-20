import { faDatabase, faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteDatabase from '@/api/server/databases/deleteDatabase.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DatabaseActionBar({
  selectedDatabases,
  clearSelection,
  onFinished,
}: {
  selectedDatabases: ObjectSet<z.infer<typeof serverDatabaseSchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const deletable = selectedDatabases.values().filter((database) => !database.isLocked);
  const skippedDeletes = selectedDatabases.size - deletable.length;

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doDelete = () => {
    setConfirming(false);

    run({
      action: 'delete',
      items: deletable,
      itemKey: 'database',
      verb: t('common.bulkActions.verb.deleted', {}),
      skipped: skippedDeletes,
      request: (database) => deleteDatabase(server.uuid, database.uuid),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title={t('pages.server.databases.modal.deleteDatabases.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('pages.server.databases.modal.deleteDatabases.content', {
            databases: tItem('database', deletable.length),
          }).md()}

          <ItemPreviewList
            items={deletable}
            getKey={(database) => database.uuid}
            renderItem={(database) => (
              <ItemPreviewRow
                icon={<FontAwesomeIcon icon={faDatabase} />}
                name={database.name}
                description={database.username}
                meta={databaseTypeLabelMapping[database.type]}
              />
            )}
          />

          {skippedDeletes > 0 && (
            <Alert color='yellow' icon={faTriangleExclamation}>
              {t('pages.server.databases.modal.deleteDatabases.alert.skipped', {
                databases: tItem('database', skippedDeletes),
              })}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedDatabases.size > 0}>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.databases.actionBar.prependedComponents}
          name='databases-actionBar-prepended'
        />

        <ServerCan action='databases.delete'>
          <Button
            color='red'
            onClick={() => setConfirming(true)}
            loading={loading === 'delete'}
            disabled={deletable.length === 0}
          >
            <FontAwesomeIcon icon={faTrash} className='mr-2' />
            {t('common.button.delete', {})} ({deletable.length})
          </Button>
        </ServerCan>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.databases.actionBar.appendedComponents}
          name='databases-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
