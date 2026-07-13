import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createServerMount from '@/api/admin/servers/mounts/createServerMount.ts';
import getAvailableServerMounts from '@/api/admin/servers/mounts/getAvailableServerMounts.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeMountSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerMountSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerMountAddModal({
  server,
  ...props
}: ModalProps & { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [selectedMount, setSelectedMount] = useState<z.infer<typeof adminNodeMountSchema> | null>(null);

  const mounts = useSearchableResource<z.infer<typeof adminServerMountSchema>>({
    queryKey: queryKeys.admin.servers.mounts(server.uuid),
    fetcher: (search) => getAvailableServerMounts(server.uuid, 1, search),
  });

  useEffect(() => {
    if (!props.opened) {
      mounts.setSearch('');
      setSelectedMount(null);
    }
  }, [props.opened]);

  const doAdd = () => {
    if (!selectedMount) return;

    setLoading(true);

    createServerMount(server.uuid, { mountUuid: selectedMount.mount.uuid })
      .then(() => {
        addToast(t('pages.admin.servers.tabs.mounts.page.toast.added', {}), 'success');

        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.mounts(server.uuid) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.servers.tabs.mounts.page.modal.add.title', {})} {...props}>
      <Stack>
        <Select
          withAsterisk
          label={t('common.form.mount', {})}
          value={selectedMount?.mount.uuid}
          onChange={(value) => setSelectedMount(mounts.items.find((m) => m.mount.uuid === value) ?? null)}
          data={mounts.items.map((mount) => ({
            label: mount.mount.name,
            value: mount.mount.uuid,
          }))}
          searchable
          searchValue={mounts.search}
          onSearchChange={mounts.setSearch}
          loading={mounts.loading}
        />

        <ModalFooter>
          <Button onClick={doAdd} loading={loading} disabled={!selectedMount}>
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
