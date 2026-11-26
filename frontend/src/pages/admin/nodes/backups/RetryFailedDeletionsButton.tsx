import { faRotateRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
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

export default function RetryFailedDeletionsButton({
  failedDeletions,
  onRetry,
  action = 'nodes.backups',
}: {
  failedDeletions: number;
  onRetry: (force: boolean) => Promise<number>;
  action?: string;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [opened, setOpened] = useState(false);
  const [force, setForce] = useState(false);

  const doClose = () => {
    setForce(false);
    setOpened(false);
  };

  const doRetry = async () => {
    const queued = await onRetry(force);

    addToast(t('common.toast.failedDeletionRetryStarted', { items: tItem('backup', queued) }), 'success');
    doClose();
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.backups.all() });
  };

  if (failedDeletions === 0) {
    return null;
  }

  return (
    <AdminCan action={action}>
      <ConfirmationModal
        opened={opened}
        onClose={doClose}
        title={t('common.modal.retryFailedDeletions.title', {})}
        confirm={t('common.button.retry', {})}
        onConfirmed={doRetry}
      >
        <Stack>
          <Text size='sm'>
            {t('common.modal.retryFailedDeletions.content', { items: tItem('backup', failedDeletions) }).md()}
          </Text>

          <Switch
            label={t('common.form.force', {})}
            name='force'
            color='red'
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />

          {force && (
            <Alert color='red' icon={faTriangleExclamation}>
              {t('common.modal.deleteFailedBackups.alert.forceWarning', {})}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <Button onClick={() => setOpened(true)} leftSection={<FontAwesomeIcon icon={faRotateRight} />}>
        {t('common.button.retryFailedDeletions', { count: failedDeletions })}
      </Button>
    </AdminCan>
  );
}
