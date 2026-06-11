import { ModalProps, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import reattachNodeBackup from '@/api/admin/nodes/backups/reattachNodeBackup.ts';
import getNodeServers from '@/api/admin/nodes/servers/getNodeServers.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  node: z.infer<typeof adminNodeSchema>;
  backup: z.infer<typeof adminServerBackupSchema>;
};

export default function NodeBackupsReattachModal({ node, backup, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [selectedServer, setSelectedServer] = useState<z.infer<typeof adminServerSchema> | null>(backup.server ?? null);
  const [loading, setLoading] = useState(false);

  const servers = useSearchableResource<z.infer<typeof adminServerSchema>>({
    queryKey: backup.isShared ? queryKeys.admin.servers.all() : queryKeys.admin.nodes.servers(node.uuid),
    fetcher: (search) => (backup.isShared ? getServers(1, search) : getNodeServers(node.uuid, 1, search)),
  });

  useEffect(() => {
    if (!opened) {
      servers.setSearch('');
      setSelectedServer(backup.server ?? null);
    }
  }, [opened]);

  const doReattach = () => {
    if (!selectedServer) {
      return;
    }

    setLoading(true);

    reattachNodeBackup(node.uuid, backup.uuid, { serverUuid: selectedServer.uuid })
      .then(() => {
        backup.server = selectedServer;
        onClose();
        addToast(t('pages.admin.nodes.tabs.backups.page.toast.reattached', { name: selectedServer.name }), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.nodes.tabs.backups.page.modal.reattach.title', {})} onClose={onClose} opened={opened}>
      <Stack>
        <p>{t('pages.admin.nodes.tabs.backups.page.modal.reattach.description', {})}</p>

        <Select
          withAsterisk
          label={t('common.table.columns.server', {})}
          placeholder={t('common.table.columns.server', {})}
          value={selectedServer?.uuid}
          onChange={(value) => setSelectedServer(servers.items.find((m) => m.uuid === value) ?? null)}
          data={servers.items.map((server) => ({
            label: server.name,
            value: server.uuid,
          }))}
          searchable
          searchValue={servers.search}
          onSearchChange={servers.setSearch}
          loading={servers.loading}
        />
      </Stack>

      <ModalFooter>
        <Button color='red' onClick={doReattach} loading={loading} disabled={!selectedServer}>
          {t('common.button.reattach', {})}
        </Button>
        <Button variant='default' onClick={onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
