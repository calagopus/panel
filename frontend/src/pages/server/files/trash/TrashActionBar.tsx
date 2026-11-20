import { faFile, faFolder, faFolderOpen, faRotateLeft, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dirname, join } from 'pathe';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteTrashEntries from '@/api/server/files/trash/deleteTrashEntries.ts';
import restoreTrashEntries from '@/api/server/files/trash/restoreTrashEntries.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverTrashEntrySchema } from '@/lib/schemas/server/files.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import TrashRestoreConflictModal, {
  collectRestoreConflicts,
  TrashRestoreConflict,
} from './TrashRestoreConflictModal.tsx';
import TrashRestoreToModal from './TrashRestoreToModal.tsx';
import { useRestoredToast } from './useRestoredToast.ts';

export default function TrashActionBar({
  selectedEntries,
  clearSelection,
  onFinished,
}: {
  selectedEntries: ObjectSet<z.infer<typeof serverTrashEntrySchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const { runRequest, loading } = useBulkAction();
  const addRestoredToast = useRestoredToast(onFinished);

  const [openModal, setOpenModal] = useState<'restoreTo' | 'delete' | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [conflicts, setConflicts] = useState<TrashRestoreConflict[] | null>(null);

  const entries = selectedEntries.values();

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doRestore = () => {
    setRestoring(true);

    restoreTrashEntries({ uuid: server.uuid, entries: entries.map((entry) => ({ uuid: entry.uuid })) })
      .then(({ restored, conflicts }) => {
        addRestoredToast(restored);
        if (conflicts.length > 0) {
          setConflicts(
            collectRestoreConflicts(
              entries.map((entry) => ({ entry })),
              conflicts,
            ),
          );
        } else if (restored.length === 0) {
          addToast(t('pages.server.files.trash.toast.nothingRestored', {}), 'error');
        }

        finish();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setRestoring(false));
  };

  const doDelete = () => {
    setOpenModal(null);

    runRequest({
      action: 'delete',
      itemKey: 'file',
      verb: t('common.bulkActions.verb.deleted', {}),
      request: () =>
        deleteTrashEntries(server.uuid, { type: 'uuids', uuids: entries.map((entry) => entry.uuid) }).then(
          ({ deleted }) => ({ affected: deleted, skipped: entries.length - deleted }),
        ),
      onFinished: finish,
    });
  };

  return (
    <>
      <TrashRestoreToModal
        entries={entries}
        opened={openModal === 'restoreTo'}
        onClose={() => setOpenModal(null)}
        onFinished={finish}
      />

      <TrashRestoreConflictModal
        opened={conflicts !== null}
        onClose={() => setConflicts(null)}
        conflicts={conflicts ?? []}
        onResolved={(remaining) => {
          setConflicts(remaining.length > 0 ? remaining : null);
          onFinished();
        }}
        onUndone={onFinished}
      />

      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.files.trash.modal.deleteEntries.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('pages.server.files.trash.modal.deleteEntries.content', {
            entries: tItem('file', entries.length),
          }).md()}

          <ItemPreviewList
            items={entries}
            getKey={(entry) => entry.uuid}
            renderItem={(entry) => (
              <ItemPreviewRow
                icon={<FontAwesomeIcon icon={entry.directory ? faFolder : faFile} />}
                name={entry.name}
                description={join('/', dirname(entry.path))}
                meta={bytesToString(entry.size)}
              />
            )}
          />
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedEntries.size > 0}>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.files.trash.actionBar.prependedComponents}
          name='filesTrash-actionBar-prepended'
        />

        <Button onClick={doRestore} loading={restoring}>
          <FontAwesomeIcon icon={faRotateLeft} className='mr-2' />
          {t('common.button.restore', {})} ({entries.length})
        </Button>
        <Button variant='default' onClick={() => setOpenModal('restoreTo')}>
          <FontAwesomeIcon icon={faFolderOpen} className='mr-2' />
          {t('pages.server.files.button.restoreTo', {})}
        </Button>
        <Button color='red' onClick={() => setOpenModal('delete')} loading={loading === 'delete'}>
          <FontAwesomeIcon icon={faTrashCan} className='mr-2' />
          {t('pages.server.files.button.deletePermanently', {})} ({entries.length})
        </Button>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.files.trash.actionBar.appendedComponents}
          name='filesTrash-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
