import {
  faFileArrowDown,
  faFileExport,
  faInfo,
  faLock,
  faLockOpen,
  faPencil,
  faRotateLeft,
  faShare,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useMemo, useState } from 'react';
import { createSearchParams, useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteBackup from '@/api/server/backups/deleteBackup.ts';
import downloadBackup from '@/api/server/backups/downloadBackup.ts';
import updateBackup from '@/api/server/backups/updateBackup.ts';
import Button from '@/elements/buttons/Button.tsx';
import BackupRetentionStatusBadge from '@/elements/data-display/BackupRetentionStatusBadge.tsx';
import BackupSourceLabel from '@/elements/data-display/BackupSourceLabel.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import HljsCode from '@/elements/editors/HljsCode.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { serverBackupKindLabelMapping, streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { bytesProgressString, bytesToString } from '@/lib/format/size.ts';
import { downloadUrl } from '@/lib/network/url.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { applyBackupUpdate } from '@/pages/server/backups/backupCache.ts';
import DatabaseInstanceBackupRestoreModal from '@/pages/server/databases/instances/modals/DatabaseInstanceBackupRestoreModal.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { SocketEvent } from '@/plugins/websocket/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { BackupColumns } from './columns.ts';
import BackupEditModal from './modals/BackupEditModal.tsx';
import BackupExportModal from './modals/BackupExportModal.tsx';
import BackupRestoreModal from './modals/BackupRestoreModal.tsx';

const loadJsonLanguage = () => import('highlight.js/lib/languages/json').then((mod) => mod.default);

interface BackupRowProps {
  backup: z.infer<typeof serverBackupSchema>;
  backupGroupName?: string;
  columns: BackupColumns;
  readOnly?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

const BackupRow = forwardRef<HTMLTableRowElement, BackupRowProps>(function BackupRow(
  { backup, backupGroupName, columns, readOnly, isSelected = false, onSelectionChange },
  ref,
) {
  const { t, tItem } = useTranslations();
  const { addToast, addPendingToast } = useToast();

  const server = useServerStore((state) => state.server);
  const socketInstance = useServerStore((state) => state.socketInstance);
  const updateStoreBackup = useServerStore((state) => state.updateBackup);
  const progress = useServerStore((state) => state.backupProgress.get(backup.uuid));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canReadDatabaseInstances = useServerCan('database-instances.read');

  const [openModal, setOpenModal] = useState<
    'edit' | 'restore' | 'restoreDatabase' | 'export' | 'delete' | 'metadata' | null
  >(null);
  const metadataJson = useMemo(() => JSON.stringify(backup.metadata, null, 2), [backup.metadata]);

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
    const pendingToast = addPendingToast(t('common.toast.preparingDownload', {}));

    return downloadBackup(server.uuid, backup.uuid, archiveFormat)
      .then(({ url }) => {
        pendingToast.settle(t('pages.server.backups.toast.downloadStarted', {}), 'success');
        downloadUrl(url, () => addToast(t('common.toast.downloadFailed', {}), 'error'));
      })
      .catch((msg) => {
        pendingToast.settle(httpErrorToHuman(msg), 'error');
      });
  };

  const waitForBackupDeleted = (uuid: string) =>
    new Promise<boolean>((resolve) => {
      if (!socketInstance) {
        resolve(false);
        return;
      }

      let timeout: ReturnType<typeof setTimeout>;
      const listener = (eventUuid: string) => {
        if (eventUuid !== uuid) return;

        clearTimeout(timeout);
        socketInstance.removeListener(SocketEvent.BACKUP_DELETED, listener);
        resolve(true);
      };

      timeout = setTimeout(() => {
        socketInstance.removeListener(SocketEvent.BACKUP_DELETED, listener);
        resolve(false);
      }, 1000);

      socketInstance.addListener(SocketEvent.BACKUP_DELETED, listener);
    });

  const doSetLocked = (locked: boolean) =>
    updateBackup(server.uuid, backup.uuid, { name: backup.name, locked, backupGroupUuid: backup.backupGroupUuid })
      .then(() => {
        addToast(
          locked ? t('pages.server.backups.toast.locked', {}) : t('pages.server.backups.toast.unlocked', {}),
          'success',
        );
        applyBackupUpdate(queryClient, server.uuid, [backup], { locked });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  const doDelete = async () => {
    try {
      await deleteBackup(server.uuid, backup.uuid);
    } catch (msg) {
      addToast(httpErrorToHuman(msg), 'error');
      return;
    }

    setOpenModal(null);

    const deleted = await waitForBackupDeleted(backup.uuid);
    if (deleted) {
      addToast(t('pages.server.backups.modal.deleteBackup.toast.deleted', {}), 'success');
    } else {
      addToast(t('pages.server.backups.modal.deleteBackup.toast.started', {}), 'success');
      updateStoreBackup(backup.uuid, { deletionStatus: 'deleting' });
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).backups.all() });
  };

  const isFailed = !backup.isSuccessful && !!backup.completed;
  const isDeleting = backup.deletionStatus === 'deleting';
  const isDeleteFailed = backup.deletionStatus === 'failed';
  const streamingDownload = backup.kind === 'server' && backup.isStreaming;

  return (
    <>
      <BackupEditModal backup={backup} opened={openModal === 'edit'} onClose={() => setOpenModal(null)} />
      <BackupRestoreModal backup={backup} opened={openModal === 'restore'} onClose={() => setOpenModal(null)} />
      <DatabaseInstanceBackupRestoreModal
        backup={backup}
        opened={openModal === 'restoreDatabase'}
        onClose={() => setOpenModal(null)}
      />
      <BackupExportModal backup={backup} opened={openModal === 'export'} onClose={() => setOpenModal(null)} />

      <Modal
        title={t('pages.server.backups.modal.viewMetadata.title', {})}
        onClose={() => setOpenModal(null)}
        opened={openModal === 'metadata'}
        size='lg'
      >
        <HljsCode languageName='json' language={loadJsonLanguage}>
          {metadataJson}
        </HljsCode>

        <ModalFooter>
          <Button variant='default' onClick={() => setOpenModal(null)}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.backups.modal.deleteBackup.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.server.backups.modal.deleteBackup.content', {
          name: backup.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faPencil,
            label: t('common.button.edit', {}),
            hidden: readOnly || isDeleting || isDeleteFailed,
            onClick: () => setOpenModal('edit'),
            color: 'gray',
            canAccess: useServerCan('backups.update'),
          },
          {
            type: 'action',
            icon: backup.isLocked ? faLockOpen : faLock,
            label: backup.isLocked
              ? t('pages.server.backups.button.unlock', {})
              : t('pages.server.backups.button.lock', {}),
            hidden: readOnly || isDeleting || isDeleteFailed,
            onClick: () => doSetLocked(!backup.isLocked),
            color: 'gray',
            canAccess: useServerCan('backups.update'),
          },
          {
            type: 'action',
            icon: faShare,
            label: t('pages.server.backups.button.browse', {}),
            hidden:
              backup.kind !== 'server' ||
              !backup.completed ||
              !backup.isBrowsable ||
              isFailed ||
              isDeleting ||
              isDeleteFailed,
            onClick: () =>
              navigate(
                `/server/${server?.uuidShort}/files?${createSearchParams({
                  directory: `/.backups/${backup.uuid}`,
                })}`,
              ),
            color: 'gray',
            canAccess: useServerCan('files.read'),
          },
          {
            type: 'action',
            icon: faFileArrowDown,
            label: t('common.button.download', {}),
            hidden: !backup.completed || isFailed || isDeleting || isDeleteFailed,
            onClick: !streamingDownload ? () => doDownload('tar_gz') : undefined,
            color: 'gray',
            items: streamingDownload
              ? Object.entries(streamingArchiveFormatLabelMapping).map(([mime, label]) => ({
                  type: 'action',
                  icon: faFileArrowDown,
                  label: t('common.button.downloadAs', { format: label }),
                  onClick: () => doDownload(mime as z.infer<typeof streamingArchiveFormat>),
                  color: 'gray',
                }))
              : [],
            canAccess: useServerCan('backups.download'),
          },
          {
            type: 'action',
            icon: faRotateLeft,
            label: t('common.button.restore', {}),
            hidden: !backup.completed || isFailed || isDeleting || isDeleteFailed,
            onClick: () => setOpenModal(backup.kind === 'server' ? 'restore' : 'restoreDatabase'),
            color: 'gray',
            canAccess: useServerCan('backups.restore'),
          },
          {
            type: 'action',
            icon: faFileExport,
            label: t('pages.server.backups.button.exportToFiles', {}),
            hidden: backup.kind !== 'server' || !backup.completed || isFailed || isDeleting || isDeleteFailed,
            onClick: () => setOpenModal('export'),
            color: 'gray',
            canAccess: useServerCan(['backups.download', 'files.create'], false),
          },
          {
            type: 'action',
            icon: faInfo,
            label: t('pages.server.backups.modal.viewMetadata.title', {}),
            hidden: backup.kind !== 'server' || Object.keys(backup.metadata).length === 0,
            onClick: () => setOpenModal('metadata'),
            color: 'gray',
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            hidden: readOnly || !backup.completed || isDeleting,
            disabled: backup.isLocked,
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: useServerCan('backups.delete'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.server.backups.backupContextMenu}
        registryProps={{ backup }}
      >
        {({ items, openMenu }) => (
          <TableRow
            ref={ref}
            className={isDeleting ? 'opacity-50' : undefined}
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={backup.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>
              <div className='min-w-0'>
                <div className='truncate'>{backup.name}</div>
                {backupGroupName && (
                  <div className='truncate text-xs text-(--mantine-color-dimmed)'>
                    {t('pages.server.backupGroups.group', {})}: {backupGroupName}
                  </div>
                )}
              </div>
            </TableData>

            {columns.kind && (
              <TableData>
                <Badge className='w-max!' variant='light' color={backup.kind === 'server' ? 'gray' : 'blue'}>
                  {serverBackupKindLabelMapping[backup.kind]()}
                </Badge>
              </TableData>
            )}

            {columns.source && (
              <TableData>
                <BackupSourceLabel
                  backup={backup}
                  to={
                    backup.databaseInstanceUuid && canReadDatabaseInstances
                      ? `/server/${server.uuidShort}/databases/instances/${backup.databaseInstanceUuid}`
                      : undefined
                  }
                />
              </TableData>
            )}

            {isDeleting || isDeleteFailed ? (
              <TableData colSpan={columns.statusColSpan}>
                {isDeleting ? (
                  <Badge className='w-max!' color='yellow'>
                    {t('pages.server.backups.badge.deleting', {})}
                  </Badge>
                ) : (
                  <Badge className='w-max!' color='red'>
                    {t('pages.server.backups.badge.deleteFailed', {})}
                  </Badge>
                )}
              </TableData>
            ) : !isFailed ? (
              <>
                <TableData>{backup.checksum && <Code>{backup.checksum}</Code>}</TableData>

                {backup.completed ? (
                  <TableData>{bytesToString(backup.bytes)}</TableData>
                ) : (
                  <TableData colSpan={columns.progressColSpan}>
                    <Tooltip
                      label={
                        columns.files
                          ? `${bytesProgressString(progress?.progress || 0, progress?.total || 0)} · ${tItem('file', progress?.files || 0)}`
                          : bytesProgressString(progress?.progress || 0, progress?.total || 0)
                      }
                      innerClassName='w-full'
                    >
                      <Progress
                        indeterminate={!progress?.total}
                        value={((progress?.progress || 0) / (progress?.total || 1)) * 100}
                      />
                    </Tooltip>
                  </TableData>
                )}

                {columns.files && (
                  <TableData hidden={!backup.completed}>{backup.completed ? backup.files : null}</TableData>
                )}
              </>
            ) : (
              <TableData colSpan={columns.statusColSpan}>
                <Badge className='w-max!' color='red'>
                  {t('common.badge.failed', {})}
                </Badge>
              </TableData>
            )}

            {columns.retention && (
              <TableData>
                <BackupRetentionStatusBadge status={backup.retentionStatus} />
              </TableData>
            )}

            <TableData>
              <FormattedTimestamp timestamp={backup.created} />
            </TableData>

            {columns.locked && (
              <TableData>
                {backup.isLocked ? (
                  <FontAwesomeIcon className='text-(--mantine-color-green-text)' icon={faLock} />
                ) : (
                  <FontAwesomeIcon className='text-(--mantine-color-red-text)' icon={faLockOpen} />
                )}
              </TableData>
            )}

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
});

export default BackupRow;
