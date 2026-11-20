import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import deleteNodeBackup from '@/api/admin/nodes/backups/deleteNodeBackup.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ForceDeleteModal from '@/elements/modals/ForceDeleteModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = Omit<ModalProps, 'title' | 'children'> & {
  node: z.infer<typeof adminNodeSchema>;
  backup: z.infer<typeof adminServerBackupSchema>;
};

export default function NodeBackupsDeleteModal({ node, backup, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [deleteDoForce, setDeleteDoForce] = useState(false);

  const doDelete = () =>
    deleteNodeBackup(node.uuid, backup.uuid, { force: deleteDoForce })
      .then(() => {
        addToast(t('pages.admin.nodes.tabs.backups.page.toast.deletionStarted', {}), 'success');
        setDeleteDoForce(false);
        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.backups.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  return (
    <ForceDeleteModal
      title={t('pages.admin.nodes.tabs.backups.page.modal.delete.title', {})}
      name={backup.name}
      force={deleteDoForce}
      onForceChange={setDeleteDoForce}
      forceWarning={t('pages.admin.nodes.tabs.backups.page.modal.delete.alert.forceWarning', {})}
      onConfirmed={doDelete}
      {...props}
    />
  );
}
