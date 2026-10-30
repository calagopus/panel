import { faMinus, faPlus, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import attachDevice from '@/api/server/devices/attachDevice.ts';
import detachDevice from '@/api/server/devices/detachDevice.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverDeviceSchema } from '@/lib/schemas/server/devices.ts';
import { setDeviceAttached } from '@/pages/server/devices/deviceCache.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DeviceActionBar({
  selectedDevices,
  clearSelection,
}: {
  selectedDevices: ObjectSet<z.infer<typeof serverDeviceSchema>, 'uuid'>;
  clearSelection: () => void;
}) {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();
  const { run, loading } = useBulkAction();

  const [confirmingDetach, setConfirmingDetach] = useState(false);

  const devices = selectedDevices.values();
  const attachable = devices.filter((device) => !device.created);
  const detachable = devices.filter((device) => device.created);
  const skippedDetaches = selectedDevices.size - detachable.length;

  const doAttach = () =>
    run({
      action: 'attach',
      items: attachable,
      itemKey: 'device',
      verb: t('common.bulkActions.verb.attached', {}),
      skipped: selectedDevices.size - attachable.length,
      request: (device) =>
        attachDevice(server.uuid, device.uuid).then(() =>
          setDeviceAttached(queryClient, server.uuid, device.uuid, true),
        ),
      onFinished: clearSelection,
    });

  const doDetach = () => {
    setConfirmingDetach(false);

    run({
      action: 'detach',
      items: detachable,
      itemKey: 'device',
      verb: t('common.bulkActions.verb.detached', {}),
      skipped: skippedDetaches,
      request: (device) =>
        detachDevice(server.uuid, device.uuid).then(() =>
          setDeviceAttached(queryClient, server.uuid, device.uuid, false),
        ),
      onFinished: clearSelection,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirmingDetach}
        onClose={() => setConfirmingDetach(false)}
        title={t('pages.server.devices.modal.detachDevices.title', {})}
        confirm={t('pages.server.devices.button.detach', {})}
        onConfirmed={doDetach}
      >
        <Stack>
          {t('pages.server.devices.modal.detachDevices.content', {
            devices: tItem('device', detachable.length),
          }).md()}

          {skippedDetaches > 0 && (
            <Alert color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              {t('pages.server.devices.modal.detachDevices.alert.skipped', {
                devices: tItem('device', skippedDetaches),
              })}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedDevices.size > 0}>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.devices.actionBar.prependedComponents}
          name='devices-actionBar-prepended'
        />

        <ServerCan action='devices.attach'>
          <Button color='green' onClick={doAttach} loading={loading === 'attach'} disabled={attachable.length === 0}>
            <FontAwesomeIcon icon={faPlus} className='mr-2' />
            {t('pages.server.devices.button.attach', {})} ({attachable.length})
          </Button>
        </ServerCan>

        <ServerCan action='devices.detach'>
          <Button
            color='red'
            onClick={() => setConfirmingDetach(true)}
            loading={loading === 'detach'}
            disabled={detachable.length === 0}
          >
            <FontAwesomeIcon icon={faMinus} className='mr-2' />
            {t('pages.server.devices.button.detach', {})} ({detachable.length})
          </Button>
        </ServerCan>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.server.devices.actionBar.appendedComponents}
          name='devices-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
