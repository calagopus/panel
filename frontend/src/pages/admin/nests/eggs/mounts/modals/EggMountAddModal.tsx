import { ModalProps, Stack } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import getMounts from '@/api/admin/mounts/getMounts.ts';
import createEggMount from '@/api/admin/nests/eggs/mounts/createEggMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function EggMountAddModal({
  nest,
  egg,
  opened,
  onClose,
}: ModalProps & { nest: z.infer<typeof adminNestSchema>; egg: z.infer<typeof adminEggSchema> }) {
  const { addToast } = useToast();
  const { addEggMount } = useAdminStore();

  const [loading, setLoading] = useState(false);
  const [mount, setMount] = useState<z.infer<typeof adminMountSchema> | null>(null);

  const mounts = useSearchableResource<z.infer<typeof adminMountSchema>>({
    queryKey: queryKeys.admin.mounts.all(),
    fetcher: (search) => getMounts(1, search),
  });

  const doAdd = () => {
    if (!mount) {
      return;
    }

    setLoading(true);

    createEggMount(nest.uuid, egg.uuid, mount.uuid)
      .then(() => {
        addToast('Egg Mount added.', 'success');

        onClose();
        addEggMount({ mount, created: new Date() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title='Add Egg Mount' onClose={onClose} opened={opened}>
      <Stack>
        <Select
          withAsterisk
          label='Mount'
          placeholder='Mount'
          value={mount?.uuid}
          onChange={(value) => setMount(mounts.items.find((m) => m.uuid === value) ?? null)}
          data={mounts.items.map((mount) => ({
            label: mount.name,
            value: mount.uuid,
          }))}
          searchable
          searchValue={mounts.search}
          onSearchChange={mounts.setSearch}
          loading={mounts.loading}
        />

        <ModalFooter>
          <Button onClick={doAdd} loading={loading} disabled={!mount}>
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
