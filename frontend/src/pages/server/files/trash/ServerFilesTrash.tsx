import { faArrowLeft, faGear, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { useNavigate } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteTrashEntries from '@/api/server/files/trash/deleteTrashEntries.ts';
import getTrashEntries from '@/api/server/files/trash/getTrashEntries.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { formatSeconds } from '@/lib/format/time.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useKeyboardShortcuts } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { fileManagerUndoScope, runLastUndoEntry } from '@/stores/undoHistory.ts';
import TrashActionBar from './TrashActionBar.tsx';
import TrashRow from './TrashRow.tsx';

export default function ServerFilesTrash() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const server = useServerStore((state) => state.server);

  const canDelete = useServerCan('files.delete');

  const [emptying, setEmptying] = useState(false);

  const {
    data: entries,
    loading,
    error,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).files.trash(),
    fetcher: (page, _search, perPage) => getTrashEntries(server.uuid, page, perPage),
  });

  const {
    selected: selectedEntries,
    toggle: toggleEntry,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: entries?.data, shortcuts: canDelete });

  useKeyboardShortcuts({
    shortcuts: [
      {
        id: 'general.undo',
        callback: () => void runLastUndoEntry(fileManagerUndoScope(server.uuid)),
      },
    ],
  });

  const doEmpty = async () => {
    await deleteTrashEntries(server.uuid, { type: 'all' })
      .then(() => {
        setEmptying(false);
        addToast(t('pages.server.files.trash.toast.emptied', {}), 'success');
        clearSelection();
        refetch();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <ServerContentContainer
      title={t('pages.server.files.trash.title', {})}
      subtitle={
        server.trash.retention === null
          ? t('pages.server.files.trash.subtitleDisabled', {})
          : t('pages.server.files.trash.subtitle', {
              retention: formatSeconds(server.trash.retention),
            })
      }
      contentRight={
        <Group>
          <Button
            variant='default'
            onClick={() => navigate(`/server/${server.uuidShort}/files`)}
            leftSection={<FontAwesomeIcon icon={faArrowLeft} />}
          >
            {t('pages.server.files.button.backToFiles', {})}
          </Button>
          {server.trash.retention === null && (
            <ServerCan action='settings.trash'>
              <Button
                variant='default'
                onClick={() => navigate(`/server/${server.uuidShort}/settings`)}
                leftSection={<FontAwesomeIcon icon={faGear} />}
              >
                {t('pages.server.files.trash.button.trashSettings', {})}
              </Button>
            </ServerCan>
          )}
          {(entries?.total ?? 0) > 0 && (
            <ServerCan action='files.delete'>
              <Button color='red' onClick={() => setEmptying(true)} leftSection={<FontAwesomeIcon icon={faTrashCan} />}>
                {t('pages.server.files.button.emptyTrash', {})}
              </Button>
            </ServerCan>
          )}
        </Group>
      }
      registry={window.extensionContext.extensionRegistry.pages.server.files.trash.container}
    >
      <ConfirmationModal
        opened={emptying}
        onClose={() => setEmptying(false)}
        title={t('pages.server.files.trash.modal.emptyTrash.title', {})}
        confirm={t('pages.server.files.button.emptyTrash', {})}
        onConfirmed={doEmpty}
      >
        {t('pages.server.files.trash.modal.emptyTrash.content', {}).md()}
      </ConfirmationModal>

      <TrashActionBar selectedEntries={selectedEntries} clearSelection={clearSelection} onFinished={refetch} />

      <SelectionArea {...selectionAreaProps} disabled={!canDelete}>
        <Table
          columns={[
            ...(canDelete
              ? [
                  tableSelectionHeader({
                    checked: allSelected,
                    indeterminate: selectedEntries.size > 0 && !allSelected,
                    onChange: (checked) => (checked ? selectAll() : clearSelection()),
                  }),
                ]
              : []),
            t('common.table.columns.name', {}),
            t('pages.server.files.trash.table.columns.originalLocation', {}),
            t('common.table.columns.size', {}),
            t('pages.server.files.trash.table.columns.deletedAt', {}),
            '',
          ]}
          loading={loading}
          pagination={entries}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
          empty={
            <EmptyState
              flush
              icon={faTrashCan}
              title={t('pages.server.files.trash.empty.title', {})}
              description={t('pages.server.files.trash.empty.description', {})}
            />
          }
        >
          {entries?.data.map((entry) => (
            <SelectionArea.Selectable key={entry.uuid} item={entry}>
              {(innerRef: Ref<HTMLElement>) => (
                <TrashRow
                  entry={entry}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedEntries.has(entry.uuid)}
                  onSelectionChange={canDelete ? (selected, range) => toggleEntry(entry, selected, range) : undefined}
                  onFinished={refetch}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </ServerContentContainer>
  );
}
