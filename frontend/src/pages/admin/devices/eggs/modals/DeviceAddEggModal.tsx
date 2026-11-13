import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createEggDevice from '@/api/admin/nests/eggs/devices/createEggDevice.ts';
import getAllEggs from '@/api/admin/nests/getAllEggs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DeviceAddEggModal({
  device,
  ...props
}: ModalProps & { device: z.infer<typeof adminDeviceSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const canReadEggs = useAdminCan('eggs.read');

  const [eggs, setEggs] = useState<Awaited<ReturnType<typeof getAllEggs>>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.opened || !canReadEggs) {
      return;
    }

    setLoading(true);
    getAllEggs()
      .then(setEggs)
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  }, [props.opened, canReadEggs]);

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.devices.tabs.eggs.page.modal.add.title', {})}
      label={t('pages.admin.devices.tabs.eggs.page.modal.add.form.egg', {})}
      loading={loading}
      data={eggs.map((group) => ({
        group: group.nest.name,
        items: group.eggs.map((egg) => ({ label: egg.name, value: egg.uuid })),
      }))}
      addedToast={t('pages.admin.devices.tabs.eggs.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.deviceAssignments.all()]}
      onConfirm={(eggUuid) => {
        const group = eggs.find((g) => g.eggs.some((egg) => egg.uuid === eggUuid));

        return group
          ? createEggDevice(group.nest.uuid, eggUuid, device.uuid)
          : Promise.reject(new Error('Could not resolve the nest for the selected egg.'));
      }}
    />
  );
}
