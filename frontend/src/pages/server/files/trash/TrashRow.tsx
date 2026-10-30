import { faFolder, faFolderOpen, faRotateLeft, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dirname, join } from 'pathe';
import { forwardRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteTrashEntries from '@/api/server/files/trash/deleteTrashEntries.ts';
import restoreTrashEntries from '@/api/server/files/trash/restoreTrashEntries.ts';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { serverTrashEntrySchema } from '@/lib/schemas/server/files.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import TrashRestoreConflictModal, {
  collectRestoreConflicts,
  TrashRestoreConflict,
} from './TrashRestoreConflictModal.tsx';
import TrashRestoreToModal from './TrashRestoreToModal.tsx';
import { useRestoredToast } from './useRestoredToast.ts';

interface TrashRowProps {
  entry: z.infer<typeof serverTrashEntrySchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
  onFinished: () => void;
}

const TrashRow = forwardRef<HTMLTableRowElement, TrashRowProps>(function TrashRow(
  { entry, isSelected = false, onSelectionChange, onFinished },
  ref,
) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const canDelete = useServerCan('files.delete');
  const addRestoredToast = useRestoredToast(onFinished);

  const [openModal, setOpenModal] = useState<'restoreTo' | 'delete' | null>(null);
  const [conflicts, setConflicts] = useState<TrashRestoreConflict[] | null>(null);

  const doRestore = () =>
    restoreTrashEntries({ uuid: server.uuid, entries: [{ uuid: entry.uuid }] })
      .then(({ restored, conflicts }) => {
        if (conflicts.length > 0) {
          setConflicts(collectRestoreConflicts([{ entry }], conflicts));
          return;
        }
        if (restored.length === 0) {
          addToast(t('pages.server.files.trash.toast.nothingRestored', {}), 'error');
          return;
        }

        addRestoredToast(restored);
        onFinished();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  const doDelete = async () => {
    await deleteTrashEntries(server.uuid, { type: 'uuids', uuids: [entry.uuid] })
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.server.files.trash.toast.deleted', { entries: tItem('file', 1) }), 'success');
        onFinished();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <TrashRestoreToModal
        entries={[entry]}
        opened={openModal === 'restoreTo'}
        onClose={() => setOpenModal(null)}
        onFinished={onFinished}
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
        title={t('pages.server.files.trash.modal.deleteEntry.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.server.files.trash.modal.deleteEntry.content', { name: entry.name }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faRotateLeft,
            label: t('common.button.restore', {}),
            onClick: doRestore,
            color: 'gray',
            canAccess: canDelete,
          },
          {
            type: 'action',
            icon: faFolderOpen,
            label: t('pages.server.files.button.restoreTo', {}),
            onClick: () => setOpenModal('restoreTo'),
            color: 'gray',
            canAccess: canDelete,
          },
          {
            type: 'action',
            icon: faTrashCan,
            label: t('pages.server.files.button.deletePermanently', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: canDelete,
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.server.files.trash.entryContextMenu}
        registryProps={{ entry }}
      >
        {({ items, openMenu }) => (
          <TableRow
            ref={ref}
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={entry.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>
              <span className='flex items-center gap-2'>
                {entry.directory && <FontAwesomeIcon icon={faFolder} className='text-(--mantine-color-dimmed)' />}
                {entry.name}
              </span>
            </TableData>

            <TableData>
              <Code>{join('/', dirname(entry.path))}</Code>
            </TableData>

            <TableData>{bytesToString(entry.size)}</TableData>

            <TableData>
              <FormattedTimestamp timestamp={entry.deletedAt} precise />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
});

export default TrashRow;
