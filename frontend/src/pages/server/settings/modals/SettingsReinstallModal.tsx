import { ModalProps } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import createBackup from '@/api/server/backups/createBackup.ts';
import getBackup from '@/api/server/backups/getBackup.ts';
import getBackups from '@/api/server/backups/getBackups.ts';
import installServer from '@/api/server/settings/installServer.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Text from '@/elements/typography/Text.tsx';
import { generateBackupName } from '@/lib/domain/server.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSettingsReinstallSchema } from '@/lib/schemas/server/settings.ts';
import { useBackupCreateGate } from '@/pages/server/backups/useBackupCreateGate.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function SettingsReinstallModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const updateServer = useServerStore((state) => state.updateServer);
  const navigate = useNavigate();
  const canStart = useServerCan('control.start');
  const canReadBackups = useServerCan('backups.read');
  const canCreateBackup = useServerCan('backups.create');
  const queryClient = useQueryClient();

  const [backupFirst, setBackupFirst] = useState(false);
  const [waitingForBackup, setWaitingForBackup] = useState(false);

  useEffect(() => {
    if (props.opened) setBackupFirst(false);
  }, [props.opened]);

  const { data: latestBackup } = useQuery({
    queryKey: [...queryKeys.server(server.uuid).backups.all(), 'latest-server'],
    queryFn: async () => {
      const filter = { kind: 'server' as const };
      const first = await getBackups(server.uuid, 1, undefined, false, filter, 10);
      const lastPage = Math.max(1, Math.ceil(first.total / 10));
      const page = lastPage === 1 ? first : await getBackups(server.uuid, lastPage, undefined, false, filter, 10);

      return page.data.filter((backup) => backup.isSuccessful && backup.completed).at(-1) ?? null;
    },
    enabled: props.opened && canReadBackups,
  });

  const createGate = useBackupCreateGate(props.opened && canCreateBackup);
  const backupBlockedReason = createGate.blocked
    ? t('pages.server.backups.tooltip.limitReached', { max: server.featureLimits.backups })
    : null;

  const createBackupAndWait = async () => {
    setWaitingForBackup(true);
    try {
      const backup = await createBackup(server.uuid, {
        name: generateBackupName(),
        backupGroupUuid: null,
        databaseInstanceUuid: null,
        ignoredFiles: [],
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).backups.all() });

      let current = backup;
      while (!current.completed) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        current = await getBackup(server.uuid, backup.uuid);
      }

      if (!current.isSuccessful) {
        throw new Error(t('pages.server.settings.reinstall.modal.backupFailed', {}));
      }
    } finally {
      setWaitingForBackup(false);
    }
  };

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverSettingsReinstallSchema>
  >({
    initialValues: {
      truncateDirectory: false,
      startOnCompletion: false,
    },
    schema: serverSettingsReinstallSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      if (backupFirst && canCreateBackup && !createGate.blocked) {
        await createBackupAndWait();
      }

      await installServer(server.uuid, values);
      addToast(t('pages.server.settings.reinstall.modal.toast.reinstalling', {}), 'success');
      navigate(`/server/${server.uuidShort}`);
      updateServer({ status: 'installing' });
    },
  });

  return (
    <FormModal
      title={t('pages.server.settings.reinstall.modal.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        {canReadBackups && latestBackup !== undefined && (
          <Text size='sm' c='dimmed'>
            {latestBackup ? (
              <>
                {t('pages.server.settings.reinstall.modal.latestBackup', {})}{' '}
                <FormattedTimestamp timestamp={latestBackup.completed} />
              </>
            ) : (
              t('pages.server.settings.reinstall.modal.noBackups', {})
            )}
          </Text>
        )}
        {canCreateBackup && (
          <Switch
            label={t('pages.server.settings.reinstall.modal.backupFirst', {})}
            description={backupBlockedReason ?? t('pages.server.settings.reinstall.modal.backupFirstDescription', {})}
            name='backupFirst'
            checked={backupFirst && !createGate.blocked}
            disabled={createGate.blocked || loading}
            onChange={(e) => setBackupFirst(e.currentTarget.checked)}
          />
        )}
        <Switch
          label={t('common.form.truncateDirectory', {})}
          name='truncate'
          {...form.getInputProps('truncateDirectory', { type: 'checkbox' })}
        />
        {form.values.truncateDirectory && (
          <Alert color='red'>
            <Text size='sm'>{t('pages.server.settings.reinstall.modal.truncateWarning', {})}</Text>
          </Alert>
        )}
        {waitingForBackup && (
          <Text size='sm' c='dimmed'>
            {t('pages.server.settings.reinstall.modal.waitingForBackup', {})}
          </Text>
        )}
        {canStart && (
          <Switch
            label={t('pages.server.settings.reinstall.modal.startOnCompletion', {})}
            name='startOnCompletion'
            {...form.getInputProps('startOnCompletion', { type: 'checkbox' })}
          />
        )}
      </Stack>

      <ModalFooter>
        <Button color='red' type='submit' loading={loading} disabled={!form.isValid()}>
          {t('pages.server.settings.reinstall.modal.button', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
