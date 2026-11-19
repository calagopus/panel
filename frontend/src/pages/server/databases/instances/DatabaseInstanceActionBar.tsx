import {
  faArrowsRotate,
  faPlay,
  faSkull,
  faStop,
  faTrash,
  faTriangleExclamation,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteDatabaseInstance from '@/api/server/databases/instances/deleteDatabaseInstance.ts';
import postDatabaseInstancePower, {
  DatabaseInstancePowerAction,
} from '@/api/server/databases/instances/postDatabaseInstancePower.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const POWER_ACTIONS = [
  { action: 'start', icon: faPlay },
  { action: 'restart', icon: faArrowsRotate },
  { action: 'stop', icon: faStop },
] as const satisfies readonly { action: DatabaseInstancePowerAction; icon: IconDefinition }[];

export default function DatabaseInstanceActionBar({
  selectedInstances,
  clearSelection,
  onFinished,
}: {
  selectedInstances: ObjectSet<z.infer<typeof serverDatabaseInstanceSchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState<'kill' | 'delete' | null>(null);

  const instances = selectedInstances.values();
  const deletable = instances.filter((instance) => !instance.isLocked);
  const skippedDeletes = selectedInstances.size - deletable.length;

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const powerVerbs: Record<DatabaseInstancePowerAction, string> = {
    start: t('common.bulkActions.verb.started', {}),
    restart: t('common.bulkActions.verb.restarted', {}),
    stop: t('common.bulkActions.verb.stopped', {}),
    kill: t('common.bulkActions.verb.killed', {}),
  };

  const doPowerAction = (action: DatabaseInstancePowerAction) => {
    setConfirming(null);

    run({
      action,
      items: instances,
      itemKey: 'databaseInstance',
      verb: powerVerbs[action],
      request: (instance) => postDatabaseInstancePower(server.uuid, instance.uuid, action),
      onFinished: finish,
    });
  };

  const doDelete = () => {
    setConfirming(null);

    run({
      action: 'delete',
      items: deletable,
      itemKey: 'databaseInstance',
      verb: t('common.bulkActions.verb.deleted', {}),
      skipped: skippedDeletes,
      request: (instance) => deleteDatabaseInstance(server.uuid, instance.uuid),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming === 'kill'}
        onClose={() => setConfirming(null)}
        title={t('pages.server.databases.instance.power.modal.forceKillBulk.title', {})}
        confirm={t('common.button.continue', {})}
        onConfirmed={() => doPowerAction('kill')}
      >
        {t('pages.server.databases.instance.power.modal.forceKillBulk.content', {
          databaseInstances: tItem('databaseInstance', instances.length),
        }).md()}
      </ConfirmationModal>

      <ConfirmationModal
        opened={confirming === 'delete'}
        onClose={() => setConfirming(null)}
        title={t('pages.server.databases.instance.modal.deleteDatabaseInstances.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('pages.server.databases.instance.modal.deleteDatabaseInstances.content', {
            databaseInstances: tItem('databaseInstance', deletable.length),
          }).md()}

          {skippedDeletes > 0 && (
            <Alert color='yellow' icon={faTriangleExclamation}>
              {t('pages.server.databases.instance.modal.deleteDatabaseInstances.alert.skipped', {
                databaseInstances: tItem('databaseInstance', skippedDeletes),
              })}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedInstances.size > 0}>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.server.databases.instances.actionBar.prependedComponents
          }
          name='databaseInstances-actionBar-prepended'
        />

        <ServerCan action='database-instances.power'>
          {POWER_ACTIONS.map(({ action, icon }) => (
            <Tooltip key={action} label={t(`common.enum.serverPowerAction.${action}`, {})}>
              <Button
                variant='default'
                onClick={() => doPowerAction(action)}
                loading={loading === action}
                aria-label={t(`common.enum.serverPowerAction.${action}`, {})}
                px='sm'
              >
                <FontAwesomeIcon icon={icon} />
              </Button>
            </Tooltip>
          ))}

          <Tooltip label={t('common.enum.serverPowerAction.kill', {})}>
            <Button
              color='red'
              onClick={() => setConfirming('kill')}
              loading={loading === 'kill'}
              aria-label={t('common.enum.serverPowerAction.kill', {})}
              px='sm'
            >
              <FontAwesomeIcon icon={faSkull} />
            </Button>
          </Tooltip>
        </ServerCan>

        <ServerCan action='database-instances.delete'>
          <Button
            color='red'
            onClick={() => setConfirming('delete')}
            loading={loading === 'delete'}
            disabled={deletable.length === 0}
          >
            <FontAwesomeIcon icon={faTrash} className='mr-2' />
            {t('common.button.delete', {})} ({deletable.length})
          </Button>
        </ServerCan>

        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.server.databases.instances.actionBar.appendedComponents
          }
          name='databaseInstances-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
