import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import reassignNodeBackup from '@/api/admin/nodes/backups/reassignNodeBackup.ts';
import getNodeServers from '@/api/admin/nodes/servers/getNodeServers.ts';
import getServerDatabaseInstances from '@/api/admin/servers/databases/getServerDatabaseInstances.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  node: z.infer<typeof adminNodeSchema>;
  backup: z.infer<typeof adminServerBackupSchema>;
};

export default function NodeBackupsReassignModal({ node, backup, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [selectedServer, setSelectedServer] = useState<z.infer<typeof adminServerSchema> | null>(backup.server ?? null);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.opened) {
      setSelectedServer(backup.server ?? null);
      setSelectedInstance(null);
    }
  }, [props.opened]);

  const instances = useInfiniteSearchableResource({
    queryKey: queryKeys.admin.databaseInstances.byServer(selectedServer?.uuid ?? ''),
    fetcher: (page, search) => getServerDatabaseInstances(selectedServer!.uuid, page, search),
    canRequest: !!selectedServer,
  });

  const matchingInstances = instances.items.filter(
    (instance) => instance.type === backup.databaseType && instance.uuid !== backup.databaseInstanceUuid,
  );

  const doReassign = () => {
    if (!selectedInstance) {
      return;
    }

    setLoading(true);

    reassignNodeBackup(node.uuid, backup.uuid, { databaseInstanceUuid: selectedInstance })
      .then(() => {
        props.onClose();
        addToast(t('pages.admin.nodes.tabs.backups.page.toast.reassigned', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.backups.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.nodes.tabs.backups.page.modal.reassign.title', {})} {...props}>
      <Stack>
        <p>
          {t('pages.admin.nodes.tabs.backups.page.modal.reassign.description', {
            type: backup.databaseType ? databaseAgentTypeLabelMapping[backup.databaseType] : '',
          })}
        </p>

        <ServerSelect<z.infer<typeof adminServerSchema>>
          withAsterisk
          label={t('common.table.columns.server', {})}
          placeholder={t('common.table.columns.server', {})}
          queryKey={backup.isShared ? queryKeys.admin.servers.all() : queryKeys.admin.nodes.servers(node.uuid)}
          paginatedFetcher={(page, search) =>
            backup.isShared ? getServers(page, search) : getNodeServers(node.uuid, page, search)
          }
          value={selectedServer?.uuid ?? null}
          selectedItem={selectedServer}
          onChange={(_, server) => {
            setSelectedServer(server);
            setSelectedInstance(null);
          }}
        />

        <Select
          withAsterisk
          label={t('common.form.databaseInstance', {})}
          placeholder={
            selectedServer
              ? t('pages.admin.nodes.tabs.backups.page.modal.reassign.instancePlaceholder', {})
              : t('pages.admin.nodes.tabs.backups.page.modal.reassign.serverFirst', {})
          }
          data={matchingInstances.map((instance) => ({ label: instance.name, value: instance.uuid }))}
          value={selectedInstance}
          onChange={setSelectedInstance}
          disabled={!selectedServer}
          loading={instances.loading}
          searchable
          searchValue={instances.search}
          onSearchChange={instances.setSearch}
          infiniteScroll={instances.infiniteScroll}
          nothingFoundMessage={t('pages.admin.nodes.tabs.backups.page.modal.reassign.noInstances', {})}
        />
      </Stack>

      <ModalFooter>
        <Button color='red' onClick={doReassign} loading={loading} disabled={!selectedInstance}>
          {t('common.button.reassign', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
