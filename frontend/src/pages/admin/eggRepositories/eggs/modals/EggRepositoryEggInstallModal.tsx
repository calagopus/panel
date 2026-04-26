import { ModalProps, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import installEgg from '@/api/admin/egg-repositories/eggs/installEgg.ts';
import getNests from '@/api/admin/nests/getNests.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function EggRepositoryEggInstallModal({
  eggRepository,
  egg,
  opened,
  onClose,
}: ModalProps & {
  eggRepository: z.infer<typeof adminEggRepositorySchema>;
  egg: z.infer<typeof adminEggRepositoryEggSchema>;
}) {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [selectedNest, setSelectedNest] = useState<z.infer<typeof adminNestSchema> | null>(null);

  const nests = useSearchableResource<z.infer<typeof adminNestSchema>>({
    queryKey: queryKeys.admin.nests.all(),
    canRequest: opened,
    fetcher: (search) => getNests(1, search),
    deps: [opened],
  });

  useEffect(() => {
    if (!opened) {
      nests.setSearch('');
      setSelectedNest(null);
    }
  }, [opened]);

  const doInstall = () => {
    if (!selectedNest) {
      return;
    }

    setLoading(true);

    installEgg(eggRepository.uuid, egg.uuid, selectedNest.uuid)
      .then(() => {
        addToast('Egg installed.', 'success');

        onClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title='Install Egg Repository Egg' onClose={onClose} opened={opened}>
      <Stack>
        <Select
          withAsterisk
          label='Nest'
          placeholder='Nest'
          value={selectedNest?.uuid}
          onChange={(value) => setSelectedNest(nests.items.find((m) => m.uuid === value) ?? null)}
          data={nests.items.map((mount) => ({
            label: mount.name,
            value: mount.uuid,
          }))}
          searchable
          searchValue={nests.search}
          onSearchChange={nests.setSearch}
          loading={nests.loading}
        />

        <ModalFooter>
          <Button onClick={doInstall} loading={loading} disabled={!selectedNest}>
            Install
          </Button>
          <Button variant='default' onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
