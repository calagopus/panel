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
import { useMemo, useState } from 'react';
import { createSearchParams, useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteBackup from '@/api/server/backups/deleteBackup.ts';
import downloadBackup from '@/api/server/backups/downloadBackup.ts';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import HljsCode from '@/elements/HljsCode.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Progress from '@/elements/Progress.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { bytesProgressString, bytesToString } from '@/lib/size.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { SocketEvent } from '@/plugins/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import BackupEditModal from './modals/BackupEditModal.tsx';
import BackupExportModal from './modals/BackupExportModal.tsx';
import BackupRestoreModal from './modals/BackupRestoreModal.tsx';

export default function BackupRow({ backup }: { backup: z.infer<typeof serverBackupSchema> }) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const server = useServerStore((state) => state.server);
  const socketInstance = useServerStore((state) => state.socketInstance);
  const updateBackup = useServerStore((state) => state.updateBackup);
  const progress = useServerStore((state) => state.backupProgress.get(backup.uuid));
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'edit' | 'restore' | 'export' | 'delete' | 'metadata' | null>(null);
  const jsonLanguage = useMemo(() => () => import('highlight.js/lib/languages/json').then((m) => m.default), []);
  const metadataJson = useMemo(() => JSON.stringify(backup.metadata, null, 2), [backup.metadata]);

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
    downloadBackup(server.uuid, backup.uuid, archiveFormat)
      .then(({ url }) => {
        addToast(t('pages.server.backups.toast.downloadStarted', {}), 'success');
        window.open(url, '_blank');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
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
      updateBackup(backup.uuid, { deletionStatus: 'deleting' });
    }

    if (backup.backupGroupUuid) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.server(server.uuid).backups.groups.detail(backup.backupGroupUuid),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).backups.groups.all() });
    }
  };

  const isFailed = !backup.isSuccessful && !!backup.completed;
  const isDeleting = backup.deletionStatus === 'deleting';
  const isDeleteFailed = backup.deletionStatus === 'failed';

  return (
    <>
      <BackupEditModal backup={backup} opened={openModal === 'edit'} onClose={() => setOpenModal(null)} />
      <BackupRestoreModal backup={backup} opened={openModal === 'restore'} onClose={() => setOpenModal(null)} />
      <BackupExportModal backup={backup} opened={openModal === 'export'} onClose={() => setOpenModal(null)} />

      <Modal
        title={t('pages.server.backups.modal.viewMetadata.title', {})}
        onClose={() => setOpenModal(null)}
        opened={openModal === 'metadata'}
        size='lg'
      >
        <HljsCode languageName='json' language={jsonLanguage}>
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
            hidden: isDeleting || isDeleteFailed,
            onClick: () => setOpenModal('edit'),
            color: 'gray',
            canAccess: useServerCan('backups.update'),
          },
          {
            type: 'action',
            icon: faShare,
            label: t('pages.server.backups.button.browse', {}),
            hidden: !backup.completed || !backup.isBrowsable || isFailed || isDeleting || isDeleteFailed,
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
            onClick: !backup.isStreaming ? () => doDownload('tar_gz') : undefined,
            color: 'gray',
            items: backup.isStreaming
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
            onClick: () => setOpenModal('restore'),
            color: 'gray',
            canAccess: useServerCan('backups.restore'),
          },
          {
            type: 'action',
            icon: faFileExport,
            label: t('pages.server.backups.button.exportToFiles', {}),
            hidden: !backup.completed || isFailed || isDeleting || isDeleteFailed,
            onClick: () => setOpenModal('export'),
            color: 'gray',
            canAccess: useServerCan(['backups.download', 'files.create'], false),
          },
          {
            type: 'action',
            icon: faInfo,
            label: t('pages.server.backups.modal.viewMetadata.title', {}),
            hidden: Object.keys(backup.metadata).length === 0,
            onClick: () => setOpenModal('metadata'),
            color: 'gray',
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            hidden: !backup.completed || isDeleting,
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
            className={isDeleting ? 'opacity-50' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>{backup.name}</TableData>

            {isDeleting || isDeleteFailed ? (
              <TableData colSpan={3}>
                {isDeleting ? (
                  <Badge color='yellow'>{t('pages.server.backups.badge.deleting', {})}</Badge>
                ) : (
                  <Badge color='red'>{t('pages.server.backups.badge.deleteFailed', {})}</Badge>
                )}
              </TableData>
            ) : !isFailed ? (
              <>
                <TableData>{backup.checksum && <Code>{backup.checksum}</Code>}</TableData>

                {backup.completed ? (
                  <TableData>{bytesToString(backup.bytes)}</TableData>
                ) : (
                  <TableData colSpan={2}>
                    <Tooltip
                      label={`${bytesProgressString(progress?.progress || 0, progress?.total || 0)} · ${tItem('file', progress?.files || 0)}`}
                      innerClassName='w-full'
                    >
                      <Progress
                        indeterminate={!progress?.total}
                        value={((progress?.progress || 0) / (progress?.total || 1)) * 100}
                      />
                    </Tooltip>
                  </TableData>
                )}

                <TableData hidden={!backup.completed}>{backup.completed ? backup.files : null}</TableData>
              </>
            ) : (
              <TableData colSpan={3}>
                <Badge color='red'>{t('common.badge.failed', {})}</Badge>
              </TableData>
            )}

            <TableData>
              <FormattedTimestamp timestamp={backup.created} />
            </TableData>

            <TableData>
              {backup.isLocked ? (
                <FontAwesomeIcon className='text-green-500' icon={faLock} />
              ) : (
                <FontAwesomeIcon className='text-red-500' icon={faLockOpen} />
              )}
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
