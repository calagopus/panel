import { ModalProps, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createEggMount from '@/api/admin/nests/eggs/mounts/createEggMount.ts';
import getAllEggs from '@/api/admin/nests/getAllEggs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function MountAddEggModal({
  mount,
  refetch,
  opened,
  onClose,
}: ModalProps & { mount: z.infer<typeof adminMountSchema>; refetch: () => void }) {
  const { addToast } = useToast();

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
        addToast('Mount Egg added.', 'success');

        onClose();
        refetch();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title='Add Mount Egg' onClose={onClose} opened={opened}>
      <Stack>
        <Select
          withAsterisk
          label='Egg'
          placeholder='Egg'
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
            Add
          </Button>
          <Button variant='default' onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
