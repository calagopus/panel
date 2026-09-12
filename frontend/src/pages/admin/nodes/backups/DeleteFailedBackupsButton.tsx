import { faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DeleteFailedBackupsButton({
  failed,
  onDelete,
  action = 'nodes.backups',
}: {
  failed: number;
  onDelete: (force: boolean) => Promise<number>;
  action?: string;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [opened, setOpened] = useState(false);
  const [force, setForce] = useState(false);

  const doClose = () => {
    setForce(false);
    setOpened(false);
  };

  const doDelete = async () => {
    const queued = await onDelete(force);

    addToast(t('common.toast.failedBackupDeletionStarted', { count: queued }), 'success');
    doClose();
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.backups.all() });
  };

  if (failed === 0) {
    return null;
  }

  return (
    <AdminCan action={action}>
      <ConfirmationModal
        opened={opened}
        onClose={doClose}
        title={t('common.modal.deleteFailedBackups.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          <Text size='sm'>{t('common.modal.deleteFailedBackups.content', { count: failed }).md()}</Text>

          <Switch
            label={t('common.form.force', {})}
            name='force'
            color='red'
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />

          {force && (
            <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              {t('common.modal.deleteFailedBackups.alert.forceWarning', {})}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <Button color='red' onClick={() => setOpened(true)} leftSection={<FontAwesomeIcon icon={faTrash} />}>
        {t('common.button.deleteFailedBackups', { count: failed })}
      </Button>
    </AdminCan>
  );
}
