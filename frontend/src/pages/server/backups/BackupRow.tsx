import {
  faFileArrowDown,
  faInfo,
  faLock,
  faLockOpen,
  faPencil,
  faRotateLeft,
  faShare,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serverBackupWithProgressSchema } from '@/lib/schemas/server/backups.ts';
import { bytesToString } from '@/lib/size.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import BackupEditModal from './modals/BackupEditModal.tsx';
import BackupRestoreModal from './modals/BackupRestoreModal.tsx';

export default function BackupRow({ backup }: { backup: z.infer<typeof serverBackupWithProgressSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, removeBackup } = useServerStore();
  const navigate = useNavigate();

  const [openModal, setOpenModal] = useState<'edit' | 'restore' | 'delete' | 'metadata' | null>(null);
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

  const doDelete = async () => {
    await deleteBackup(server.uuid, backup.uuid)
      .then(() => {
        addToast(t('pages.server.backups.modal.deleteBackup.toast.deleted', {}), 'success');
        setOpenModal(null);
        removeBackup(backup);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const isFailed = !backup.isSuccessful && !!backup.completed;

  return (
    <>
      <BackupEditModal backup={backup} opened={openModal === 'edit'} onClose={() => setOpenModal(null)} />
      <BackupRestoreModal backup={backup} opened={openModal === 'restore'} onClose={() => setOpenModal(null)} />

      <Modal
        title={t('pages.server.backups.modal.viewMetadata.title', {})}
        onClose={() => setOpenModal(null)}
        opened={openModal === 'metadata'}
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
        {t('pages.server.backups.modal.deleteBackup.content', { name: backup.name }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('edit'),
            color: 'gray',
            canAccess: useServerCan('backups.update'),
          },
          {
            icon: faShare,
            label: t('pages.server.backups.button.browse', {}),
            hidden: !backup.completed || !backup.isBrowsable || isFailed,
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
            icon: faFileArrowDown,
            label: t('common.button.download', {}),
            hidden: !backup.completed || isFailed,
            onClick: !backup.isStreaming ? () => doDownload('tar_gz') : undefined,
            color: 'gray',
            items: backup.isStreaming
              ? Object.entries(streamingArchiveFormatLabelMapping).map(([mime, label]) => ({
                  icon: faFileArrowDown,
                  label: t('common.button.downloadAs', { format: label }),
                  onClick: () => doDownload(mime as z.infer<typeof streamingArchiveFormat>),
                  color: 'gray',
                }))
              : [],
            canAccess: useServerCan('backups.download'),
          },
          {
            icon: faRotateLeft,
            label: t('common.button.restore', {}),
            hidden: !backup.completed || isFailed,
            onClick: () => setOpenModal('restore'),
            color: 'gray',
            canAccess: useServerCan('backups.restore'),
          },
          {
            icon: faInfo,
            label: t('pages.server.backups.modal.viewMetadata.title', {}),
            hidden: Object.keys(backup.metadata).length === 0,
            onClick: () => setOpenModal('metadata'),
            color: 'gray',
          },
          {
            icon: faTrash,
            label: t('common.button.delete', {}),
            hidden: !backup.completed,
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
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.pageX, e.pageY);
            }}
          >
            <TableData>{backup.name}</TableData>

            {!isFailed ? (
              <>
                <TableData>{backup.checksum && <Code>{backup.checksum}</Code>}</TableData>

                {backup.completed ? (
                  <TableData>{bytesToString(backup.bytes)}</TableData>
                ) : (
                  <TableData colSpan={2}>
                    <Tooltip
                      label={`${bytesToString(backup.progress?.progress || 0)} / ${bytesToString(backup.progress?.total || 0)}`}
                      innerClassName='w-full'
                    >
                      <Progress value={((backup.progress?.progress || 0) / (backup.progress?.total || 1)) * 100} />
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
