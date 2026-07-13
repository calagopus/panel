import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import getDatabaseAgentHosts from '@/api/admin/database-agent-hosts/getDatabaseAgentHosts.ts';
import createLocationDatabaseAgentHost from '@/api/admin/locations/database-agent-hosts/createLocationDatabaseAgentHost.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function LocationDatabaseAgentHostCreateModal({
  location,
  ...props
}: ModalProps & { location: z.infer<typeof adminLocationSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [databaseAgentHost, setDatabaseAgentHost] = useState<z.infer<typeof adminDatabaseAgentHostSchema> | null>(null);

  const databaseAgentHosts = useSearchableResource<z.infer<typeof adminDatabaseAgentHostSchema>>({
    queryKey: queryKeys.admin.databaseAgentHosts.all(),
    fetcher: (search) => getDatabaseAgentHosts(1, search),
  });

  const doCreate = () => {
    if (!databaseAgentHost) {
      return;
    }

    setLoading(true);

    createLocationDatabaseAgentHost(location.uuid, databaseAgentHost.uuid)
      .then(() => {
        addToast(t('pages.admin.locations.tabs.databaseAgentHosts.page.toast.created', {}), 'success');

        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.locations.databaseAgentHosts(location.uuid) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.locations.tabs.databaseAgentHosts.page.modal.create.title', {})} {...props}>
      <Stack>
        <Select
          withAsterisk
          label={t('common.form.databaseAgentHost', {})}
          value={databaseAgentHost?.uuid}
          onChange={(value) =>
            setDatabaseAgentHost(databaseAgentHosts.items.find((host) => host.uuid === value) ?? null)
          }
          data={databaseAgentHosts.items.map((host) => ({ value: host.uuid, label: host.name }))}
          searchable
          searchValue={databaseAgentHosts.search}
          onSearchChange={databaseAgentHosts.setSearch}
          loading={databaseAgentHosts.loading}
        />

        <ModalFooter>
          <Button onClick={doCreate} loading={loading} disabled={!databaseAgentHost}>
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
