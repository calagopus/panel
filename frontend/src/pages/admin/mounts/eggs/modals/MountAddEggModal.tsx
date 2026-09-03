import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createEggMount from '@/api/admin/nests/eggs/mounts/createEggMount.ts';
import getAllEggs from '@/api/admin/nests/getAllEggs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MountAddEggModal({
  mount,
  ...props
}: ModalProps & { mount: z.infer<typeof adminMountSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [eggs, setEggs] = useState<Awaited<ReturnType<typeof getAllEggs>>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.opened) {
      return;
    }

    setLoading(true);
    getAllEggs()
      .then(setEggs)
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  }, [props.opened]);

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.mounts.tabs.eggs.page.modal.add.title', {})}
      label={t('pages.admin.mounts.tabs.eggs.page.modal.add.form.egg', {})}
      loading={loading}
      data={eggs.map((group) => ({
        group: group.nest.name,
        items: group.eggs.map((egg) => ({ label: egg.name, value: egg.uuid })),
      }))}
      addedToast={t('pages.admin.mounts.tabs.eggs.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.mountAssignments.all()]}
      onConfirm={(eggUuid) => {
        const group = eggs.find((g) => g.eggs.some((egg) => egg.uuid === eggUuid));

        return group
          ? createEggMount(group.nest.uuid, eggUuid, mount.uuid)
          : Promise.reject(new Error('Could not resolve the nest for the selected egg.'));
      }}
    />
  );
}
