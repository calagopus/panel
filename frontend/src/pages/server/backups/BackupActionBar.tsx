import { faLayerGroup, faLock, faLockOpen, faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import deleteBackups from '@/api/server/backups/deleteBackups.ts';
import updateBackups from '@/api/server/backups/updateBackups.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupGroupSchema, serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { applyBackupUpdate } from '@/pages/server/backups/backupCache.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function BackupActionBar({
  selectedBackups,
  groups,
  clearSelection,
}: {
  selectedBackups: ObjectSet<z.infer<typeof serverBackupSchema>, 'uuid'>;
  groups: z.infer<typeof serverBackupGroupSchema>[];
  clearSelection: () => void;
}) {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const { runRequest, loading } = useBulkAction();
  const queryClient = useQueryClient();

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const backups = selectedBackups.values();
  const deletable = backups.filter(
    (backup) => backup.completed && !backup.isLocked && backup.deletionStatus !== 'deleting',
  );
  const lockable = backups.filter((backup) => !backup.isLocked);
  const unlockable = backups.filter((backup) => backup.isLocked);
  const skippedDeletes = selectedBackups.size - deletable.length;

  const finish = () => {
    clearSelection();
    queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).backups.all() });
  };

  const doSetLocked = (locked: boolean) => {
    const targets = locked ? lockable : unlockable;

    runRequest({
      action: locked ? 'lock' : 'unlock',
      itemKey: 'backup',
      verb: locked ? t('common.bulkActions.verb.locked', {}) : t('common.bulkActions.verb.unlocked', {}),
      request: () =>
        updateBackups(server.uuid, {
          selector: { type: 'uuids', uuids: targets.map((backup) => backup.uuid) },
          locked,
        }).then(({ updated, skipped }) => {
          if (skipped === 0) {
            applyBackupUpdate(queryClient, server.uuid, targets, { locked });
          } else {
            queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).backups.all() });
          }

          return { affected: updated, skipped };
        }),
      onFinished: clearSelection,
    });
  };

  const doMoveToGroup = (backupGroupUuid: string | null) =>
    runRequest({
      action: 'move',
      itemKey: 'backup',
      verb: t('common.bulkActions.verb.moved', {}),
      request: () =>
        updateBackups(server.uuid, {
          selector: { type: 'uuids', uuids: backups.map((backup) => backup.uuid) },
          backupGroupUuid,
        }).then(({ updated, skipped }) => ({ affected: updated, skipped })),
      onFinished: finish,
    });

  const doDelete = () => {
    setConfirmingDelete(false);

    runRequest({
      action: 'delete',
      itemKey: 'backup',
      verb: t('common.bulkActions.verb.deleted', {}),
      request: () =>
        deleteBackups(server.uuid, {
          type: 'uuids',
          uuids: deletable.map((backup) => backup.uuid),
        }).then(({ queued, skipped }) => ({ affected: queued, skipped })),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={t('pages.server.backups.modal.deleteBackups.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('pages.server.backups.modal.deleteBackups.content', {
            backups: tItem('backup', deletable.length),
          }).md()}

          {skippedDeletes > 0 && (
            <Alert color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              {t('pages.server.backups.modal.deleteBackups.alert.skipped', {
                backups: tItem('backup', skippedDeletes),
              })}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedBackups.size > 0}>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.backups.actionBar.prependedComponents}
          name='backups-actionBar-prepended'
        />

        <ServerCan action={['backups.update', 'backup-groups.read']}>
          <ContextMenu
            menuProps={{ position: 'top-start' }}
            items={[
              ...groups.map(
                (group) =>
                  ({
                    type: 'action',
                    icon: faLayerGroup,
                    label: group.name,
                    onClick: () => doMoveToGroup(group.uuid),
                    color: 'gray',
                  }) as const,
              ),
              { type: 'divider' },
              {
                type: 'action',
                label: t('pages.server.backups.button.removeFromGroup', {}),
                onClick: () => doMoveToGroup(null),
                color: 'red',
              },
            ]}
          >
            {({ openMenu }) => (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openMenu(rect.left, rect.top);
                }}
                loading={loading === 'move'}
                disabled={groups.length === 0}
              >
                <FontAwesomeIcon icon={faLayerGroup} className='mr-2' />
                {t('pages.server.backups.button.moveToGroup', {})} ({backups.length})
              </Button>
            )}
          </ContextMenu>
        </ServerCan>

        <ServerCan action='backups.update'>
          <Button
            variant='default'
            onClick={() => doSetLocked(true)}
            loading={loading === 'lock'}
            disabled={lockable.length === 0}
          >
            <FontAwesomeIcon icon={faLock} className='mr-2' />
            {t('pages.server.backups.button.lock', {})} ({lockable.length})
          </Button>

          <Button
            variant='default'
            onClick={() => doSetLocked(false)}
            loading={loading === 'unlock'}
            disabled={unlockable.length === 0}
          >
            <FontAwesomeIcon icon={faLockOpen} className='mr-2' />
            {t('pages.server.backups.button.unlock', {})} ({unlockable.length})
          </Button>
        </ServerCan>

        <ServerCan action='backups.delete'>
          <Button
            color='red'
            onClick={() => setConfirmingDelete(true)}
            loading={loading === 'delete'}
            disabled={deletable.length === 0}
          >
            <FontAwesomeIcon icon={faTrash} className='mr-2' />
            {t('common.button.delete', {})} ({deletable.length})
          </Button>
        </ServerCan>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.backups.actionBar.appendedComponents}
          name='backups-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
