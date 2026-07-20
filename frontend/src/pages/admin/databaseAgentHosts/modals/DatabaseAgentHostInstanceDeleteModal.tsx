import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import deleteDatabaseAgentHostInstance from '@/api/admin/database-agent-hosts/deleteDatabaseAgentHostInstance.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentBaseSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  hostUuid: string;
  serverUuid: string;
  instance: z.infer<typeof adminDatabaseAgentBaseSchema>;
};

export default function DatabaseAgentHostInstanceDeleteModal({ hostUuid, serverUuid, instance, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [deleteDoForce, setDeleteDoForce] = useState(false);

  const doDelete = () =>
    deleteDatabaseAgentHostInstance(hostUuid, instance.uuid, { force: deleteDoForce })
      .then(() => {
        addToast(
          t('pages.admin.databaseAgentHosts.tabs.instances.page.modal.deleteInstance.toast.deleted', {}),
          'success',
        );
        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.databaseAgentHosts.instances(hostUuid) });
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.databaseInstances(serverUuid) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  return (
    <ConfirmationModal
      title={t('pages.admin.databaseAgentHosts.tabs.instances.page.modal.deleteInstance.title', {})}
      onConfirmed={doDelete}
      {...props}
    >
      <Stack>
        <Text size='sm'>
          {t('pages.admin.databaseAgentHosts.tabs.instances.page.modal.deleteInstance.content', {
            name: instance.name,
          }).md()}
        </Text>

        <Switch
          label={t('common.form.force', {})}
          name='force'
          color='red'
          checked={deleteDoForce}
          onChange={(e) => setDeleteDoForce(e.target.checked)}
        />

        {deleteDoForce && (
          <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
            {t('pages.admin.databaseAgentHosts.tabs.instances.page.modal.deleteInstance.alert.forceWarning', {})}
          </Alert>
        )}
      </Stack>
    </ConfirmationModal>
  );
}
