import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import getDatabaseHosts from '@/api/admin/database-hosts/getDatabaseHosts.ts';
import createNodeDatabaseHost from '@/api/admin/nodes/database-hosts/createNodeDatabaseHost.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeDatabaseHostCreateModal({
  node,
  ...props
}: ModalProps & { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [databaseHost, setDatabaseHost] = useState<z.infer<typeof adminDatabaseHostSchema> | null>(null);

  const databaseHosts = useSearchableResource<z.infer<typeof adminDatabaseHostSchema>>({
    queryKey: queryKeys.admin.databaseHosts.all(),
    fetcher: (search) => getDatabaseHosts(1, search),
  });

  const doCreate = () => {
    if (!databaseHost) {
      return;
    }

    setLoading(true);

    createNodeDatabaseHost(node.uuid, databaseHost.uuid)
      .then(() => {
        addToast(t('pages.admin.nodes.tabs.databaseHosts.page.toast.created', {}), 'success');

        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.databaseHosts(node.uuid) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.nodes.tabs.databaseHosts.page.modal.create.title', {})} {...props}>
      <Stack>
        <Select
          withAsterisk
          label={t('common.form.databaseHost', {})}
          value={databaseHost?.uuid}
          onChange={(value) => setDatabaseHost(databaseHosts.items.find((dh) => dh.uuid === value) ?? null)}
          data={Object.values(
            databaseHosts.items.reduce((acc, { uuid, name, type }) => {
              if (!acc[type]) {
                acc[type] = { group: databaseTypeLabelMapping[type], items: [] };
              }
              acc[type].items.push({
                value: uuid,
                label: name,
              });
              return acc;
            }, {} as GroupedDatabaseHosts),
          )}
          searchable
          searchValue={databaseHosts.search}
          onSearchChange={databaseHosts.setSearch}
          loading={databaseHosts.loading}
        />

        <ModalFooter>
          <Button onClick={doCreate} loading={loading} disabled={!databaseHost}>
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
