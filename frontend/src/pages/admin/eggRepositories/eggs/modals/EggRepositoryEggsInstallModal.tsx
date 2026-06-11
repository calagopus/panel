import { ModalProps, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import installEggs from '@/api/admin/egg-repositories/eggs/installEggs.ts';
import getNests from '@/api/admin/nests/getNests.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggRepositoryEggsInstallModal({
  eggRepository,
  selectedEggs,
  setSelectedEggs,
  opened,
  onClose,
}: ModalProps & {
  eggRepository: z.infer<typeof adminEggRepositorySchema>;
  selectedEggs: ObjectSet<z.infer<typeof adminEggRepositoryEggSchema>, 'uuid'>;
  setSelectedEggs: (eggs: ObjectSet<z.infer<typeof adminEggRepositoryEggSchema>, 'uuid'>) => void;
}) {
  const { t, tItem } = useTranslations();
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

    installEggs(eggRepository.uuid, selectedEggs.keys(), selectedNest.uuid)
      .then((installed) => {
        addToast(
          t('pages.admin.eggRepositories.tabs.eggs.page.toast.installedBulk', { eggs: tItem('egg', installed) }),
          'success',
        );
        setSelectedEggs(new ObjectSet('uuid'));

        onClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('pages.admin.eggRepositories.tabs.eggs.page.modal.installBulk.title', {})}
      onClose={onClose}
      opened={opened}
    >
      <Stack>
        <Select
          withAsterisk
          label={t('common.form.nest', {})}
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
            {t('pages.admin.eggRepositories.tabs.eggs.page.modal.installBulk.button', {
              eggs: tItem('egg', selectedEggs.size),
            })}
          </Button>
          <Button variant='default' onClick={onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
