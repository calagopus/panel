import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import deleteNodeBackup from '@/api/admin/nodes/backups/deleteNodeBackup.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

type Props = ModalProps & {
  node: z.infer<typeof adminNodeSchema>;
  backup: z.infer<typeof adminServerBackupSchema>;
};

export default function NodeBackupsDeleteModal({ node, backup, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const removeNodeBackup = useAdminStore((state) => state.removeNodeBackup);

  const [loading, setLoading] = useState(false);
  const [deleteDoForce, setDeleteDoForce] = useState(false);

  const doDelete = () => {
    setLoading(true);
    deleteNodeBackup(node.uuid, backup.uuid, {
      force: deleteDoForce,
    })
      .then(() => {
        addToast(t('pages.admin.nodes.tabs.backups.page.toast.deleted', {}), 'success');
        props.onClose();
        removeNodeBackup(backup);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      <Modal title={t('pages.admin.nodes.tabs.backups.page.modal.delete.title', {})} {...props}>
        <Stack>
          <Switch
            label={t('pages.admin.nodes.tabs.backups.page.modal.delete.form.force', {})}
            name='force'
            defaultChecked={deleteDoForce}
            onChange={(e) => setDeleteDoForce(e.target.checked)}
          />
        </Stack>

        <ModalFooter>
          <Button color='red' loading={loading} onClick={doDelete}>
            {t('common.button.okay', {})}
          </Button>
          <Button variant='default' onClick={() => props.onClose()}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
