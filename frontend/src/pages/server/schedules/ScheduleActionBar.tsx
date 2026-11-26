import { faBan, faCheck, faChevronDown, faPlay, faPlayCircle, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteSchedule from '@/api/server/schedules/deleteSchedule.ts';
import triggerSchedule from '@/api/server/schedules/triggerSchedule.ts';
import updateSchedule from '@/api/server/schedules/updateSchedule.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverScheduleSchema } from '@/lib/schemas/server/schedules.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ScheduleActionBar({
  selectedSchedules,
  clearSelection,
  onFinished,
}: {
  selectedSchedules: ObjectSet<z.infer<typeof serverScheduleSchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const { run, loading } = useBulkAction();

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const schedules = selectedSchedules.values();
  const disabledSchedules = schedules.filter((schedule) => !schedule.enabled);
  const enabledSchedules = schedules.filter((schedule) => schedule.enabled);

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doToggle = (enabled: boolean) => {
    const targets = enabled ? disabledSchedules : enabledSchedules;

    run({
      action: enabled ? 'enable' : 'disable',
      items: targets,
      itemKey: 'schedule',
      verb: enabled ? t('common.bulkActions.verb.enabled', {}) : t('common.bulkActions.verb.disabled', {}),
      skipped: selectedSchedules.size - targets.length,
      request: (schedule) => updateSchedule(server.uuid, schedule.uuid, { enabled }),
      onFinished: finish,
    });
  };

  const doRun = (skipCondition: boolean) =>
    run({
      action: skipCondition ? 'runIgnoringConditions' : 'run',
      items: enabledSchedules,
      itemKey: 'schedule',
      verb: t('common.bulkActions.verb.triggered', {}),
      skipped: selectedSchedules.size - enabledSchedules.length,
      request: (schedule) => triggerSchedule(server.uuid, schedule.uuid, skipCondition),
      onFinished: finish,
    });

  const doDelete = () => {
    setConfirmingDelete(false);

    run({
      action: 'delete',
      items: schedules,
      itemKey: 'schedule',
      verb: t('common.bulkActions.verb.deleted', {}),
      request: (schedule) => deleteSchedule(server.uuid, schedule.uuid),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={t('pages.server.schedules.modal.deleteSchedules.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('common.modal.deleteFromServer.content', {
          name: tItem('schedule', schedules.length),
        }).md()}
      </ConfirmationModal>

      <ActionBar opened={selectedSchedules.size > 0}>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.schedules.actionBar.prependedComponents}
          name='schedules-actionBar-prepended'
        />

        <ServerCan action='schedules.update'>
          <ContextMenu
            menuProps={{ position: 'top-start' }}
            items={[
              {
                type: 'action',
                icon: faPlayCircle,
                label: t('pages.server.schedules.button.runNowWithConditions', {}),
                onClick: () => doRun(false),
                color: 'gray',
              },
              {
                type: 'action',
                icon: faPlay,
                label: t('pages.server.schedules.button.runNowIgnoreConditions', {}),
                onClick: () => doRun(true),
                color: 'gray',
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
                color='green'
                loading={loading === 'run' || loading === 'runIgnoringConditions'}
                disabled={enabledSchedules.length === 0}
                rightSection={<FontAwesomeIcon icon={faChevronDown} />}
              >
                {t('pages.server.schedules.button.runNow', {})} ({enabledSchedules.length})
              </Button>
            )}
          </ContextMenu>

          <Button
            color='green'
            onClick={() => doToggle(true)}
            loading={loading === 'enable'}
            disabled={disabledSchedules.length === 0}
          >
            <FontAwesomeIcon icon={faCheck} className='mr-2' />
            {t('common.button.enable', {})} ({disabledSchedules.length})
          </Button>

          <Button
            variant='default'
            onClick={() => doToggle(false)}
            loading={loading === 'disable'}
            disabled={enabledSchedules.length === 0}
          >
            <FontAwesomeIcon icon={faBan} className='mr-2' />
            {t('common.button.disable', {})} ({enabledSchedules.length})
          </Button>
        </ServerCan>

        <ServerCan action='schedules.delete'>
          <Button color='red' onClick={() => setConfirmingDelete(true)} loading={loading === 'delete'}>
            <FontAwesomeIcon icon={faTrash} className='mr-2' />
            {t('common.button.delete', {})} ({schedules.length})
          </Button>
        </ServerCan>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.schedules.actionBar.appendedComponents}
          name='schedules-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
