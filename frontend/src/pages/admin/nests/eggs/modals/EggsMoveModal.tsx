import { ModalProps, Stack } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import moveEggs from '@/api/admin/nests/eggs/moveEggs.ts';
import getNests from '@/api/admin/nests/getNests.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function EggsMoveModal({
  nest,
  selectedEggs,
  invalidateEggs,
  opened,
  onClose,
}: ModalProps & {
  nest: z.infer<typeof adminNestSchema>;
  selectedEggs: ObjectSet<z.infer<typeof adminEggSchema>, 'uuid'>;
  invalidateEggs: () => void;
}) {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [selectedNest, setSelectedNest] = useState<z.infer<typeof adminNestSchema> | null>(null);

  const nests = useSearchableResource<z.infer<typeof adminNestSchema>>({
    queryKey: queryKeys.admin.nests.all(),
    fetcher: (search) => getNests(1, search),
  });

  const doMove = () => {
    if (!selectedNest) {
      return;
    }

    setLoading(true);

    moveEggs(nest.uuid, selectedEggs.keys(), selectedNest.uuid)
      .then(({ moved }) => {
        addToast(`${moved} Egg${moved == 1 ? '' : 's'} moved.`, 'success');
        invalidateEggs();
        onClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title='Move Eggs' onClose={onClose} opened={opened}>
      <Stack>
        <Select
          withAsterisk
          label='Nest'
          placeholder='Nest'
          value={selectedNest?.uuid}
          onChange={(value) => setSelectedNest(nests.items.find((m) => m.uuid === value) ?? null)}
          data={nests.items.map((nest) => ({
            label: nest.name,
            value: nest.uuid,
          }))}
          searchable
          searchValue={nests.search}
          onSearchChange={nests.setSearch}
          loading={nests.loading}
        />

        <ModalFooter>
          <Button onClick={doMove} loading={loading} disabled={!selectedNest}>
            Move {selectedEggs.size} Egg{selectedEggs.size == 1 ? '' : 's'}
          </Button>
          <Button variant='default' onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
