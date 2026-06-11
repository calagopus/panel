import { ModalProps, Stack } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import moveEgg from '@/api/admin/nests/eggs/moveEgg.ts';
import getNests from '@/api/admin/nests/getNests.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggMoveModal({
  nest,
  egg,
  opened,
  onClose,
}: ModalProps & { nest: z.infer<typeof adminNestSchema>; egg: z.infer<typeof adminEggSchema> }) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const navigate = useNavigate();

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

    moveEgg(nest.uuid, egg.uuid, selectedNest.uuid)
      .then(() => {
        addToast(t('pages.admin.nests.tabs.eggs.page.toast.moved', {}), 'success');
        navigate(`/admin/nests/${selectedNest.uuid}/eggs/${egg.uuid}`);

        onClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.nests.tabs.eggs.page.modal.move.title', {})} onClose={onClose} opened={opened}>
      <Stack>
        <Select
          withAsterisk
          label={t('common.form.nest', {})}
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
            {t('common.button.move', {})}
          </Button>
          <Button variant='default' onClick={onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
