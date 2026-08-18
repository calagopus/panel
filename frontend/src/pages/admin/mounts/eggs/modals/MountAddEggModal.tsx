import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createEggMount from '@/api/admin/nests/eggs/mounts/createEggMount.ts';
import getAllEggs from '@/api/admin/nests/getAllEggs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MountAddEggModal({
  mount,
  ...props
}: ModalProps & { mount: z.infer<typeof adminMountSchema> }) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [selectedEgg, setSelectedEgg] = useState<[string, string] | null>(null);

  const [eggs, setEggs] = useState<Awaited<ReturnType<typeof getAllEggs>>>([]);

  useEffect(() => {
    getAllEggs()
      .then((eggs) => {
        setEggs(eggs);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  }, []);

  const doAdd = () => {
    if (!selectedEgg) {
      return;
    }

    setLoading(true);

    const [nestUuid, eggUuid] = selectedEgg;

    createEggMount(nestUuid, eggUuid, mount.uuid)
      .then(() => {
        addToast(t('pages.admin.mounts.tabs.eggs.page.toast.added', {}), 'success');

        props.onClose();

        queryClient.invalidateQueries({ queryKey: queryKeys.admin.mountAssignments.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.mounts.tabs.eggs.page.modal.add.title', {})} {...props}>
      <Stack>
        <Select
          withAsterisk
          label={t('pages.admin.mounts.tabs.eggs.page.modal.add.form.egg', {})}
          value={selectedEgg?.[1]}
          onChange={(value) =>
            setSelectedEgg(
              eggs.flatMap((g) => g.eggs).find((e) => e.uuid === value) && value
                ? [eggs.find((g) => g.eggs.some((e) => e.uuid === value))?.nest.uuid ?? '', value]
                : null,
            )
          }
          data={eggs.map((v) => ({
            group: v.nest.name,
            items: v.eggs.map((e) => ({
              label: e.name,
              value: e.uuid,
            })),
          }))}
          searchable
        />

        <ModalFooter>
          <Button onClick={doAdd} loading={loading} disabled={!selectedEgg}>
            {t('common.button.add', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
