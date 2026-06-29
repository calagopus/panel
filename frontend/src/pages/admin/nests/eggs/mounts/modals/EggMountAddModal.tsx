import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import getMounts from '@/api/admin/mounts/getMounts.ts';
import createEggMount from '@/api/admin/nests/eggs/mounts/createEggMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggMountAddModal({
  nest,
  egg,
  ...props
}: ModalProps & { nest: z.infer<typeof adminNestSchema>; egg: z.infer<typeof adminEggSchema> }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslations();

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
        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.mounts.page.toast.added', {}), 'success');

        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.eggs.mounts(egg.uuid) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.nests.tabs.eggs.page.tabs.mounts.page.modal.add.title', {})} {...props}>
      <Stack>
        <Select
          withAsterisk
          label={t('common.form.mount', {})}
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
