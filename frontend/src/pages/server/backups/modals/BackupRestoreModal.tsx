import { ModalProps, Stack, Switch } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import restoreBackup from '@/api/server/backups/restoreBackup.ts';
import Button from '@/elements/Button.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  backup: z.infer<typeof serverBackupSchema>;
};

export default function BackupRestoreModal({ backup, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, updateServer } = useServerStore();
  const navigate = useNavigate();

  const [truncateDirectory, setTruncateDirectory] = useState(false);
  const [restoreStartup, setRestoreStartup] = useState(false);
  const [loading, setLoading] = useState(false);

  const doRestore = () => {
    setLoading(true);

    restoreBackup(server.uuid, backup.uuid, { truncateDirectory, restoreStartup })
      .then(() => {
        onClose();
        addToast(t('pages.server.backups.toast.restoringBackup', {}), 'success');

        navigate(`/server/${server.uuidShort}`);
        updateServer({ status: 'restoring_backup' });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.backups.modal.restoreBackup.title', {})} onClose={onClose} opened={opened}>
      <Stack>
        <Switch
          label={t('common.form.truncateDirectory', {})}
          name='truncateDirectory'
          checked={truncateDirectory}
          onChange={(e) => setTruncateDirectory(e.target.checked)}
        />

        <Switch
          label={t('pages.server.backups.modal.restoreBackup.form.restoreStartup', {})}
          name='restoreStartup'
          checked={restoreStartup}
          disabled={Object.keys(backup.metadata).length === 0}
          onChange={(e) => setRestoreStartup(e.target.checked)}
        />
      </Stack>

      <ModalFooter>
        <Button color={truncateDirectory ? 'red' : undefined} onClick={doRestore} loading={loading}>
          {t('common.button.restore', {})}
        </Button>
        <Button variant='default' onClick={onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
