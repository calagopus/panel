import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getServers from '@/api/admin/servers/getServers.ts';
import createSystemBackupPolicyServer from '@/api/admin/system-backup-policies/servers/createSystemBackupPolicyServer.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SystemBackupPolicyAddServerModal({
  systemBackupPolicy,
  refetch,
  ...props
}: ModalProps & { systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>; refetch: () => void }) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [loading, setLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState<z.infer<typeof adminServerSchema> | null>(null);

  useEffect(() => {
    if (!props.opened) {
      setSelectedServer(null);
    }
  }, [props.opened]);

  const doAdd = () => {
    if (!selectedServer) {
      return;
    }

    setLoading(true);

    createSystemBackupPolicyServer(systemBackupPolicy.uuid, selectedServer.uuid)
      .then(() => {
        addToast(t('pages.admin.systemBackupPolicies.tabs.servers.page.toast.added', {}), 'success');

        props.onClose();
        refetch();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.systemBackupPolicies.tabs.servers.page.modal.add.title', {})} {...props}>
      <Stack>
        <ServerSelect<z.infer<typeof adminServerSchema>>
          withAsterisk
          label={t('common.form.server', {})}
          placeholder={t('common.form.server', {})}
          queryKey={queryKeys.admin.servers.all()}
          fetcher={(search) => getServers(1, search)}
          value={selectedServer?.uuid ?? null}
          selectedItem={selectedServer}
          onChange={(_, server) => setSelectedServer(server)}
        />

        <ModalFooter>
          <Button onClick={doAdd} loading={loading} disabled={!selectedServer}>
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
