import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import createBackupGroup from '@/api/server/backups/groups/createBackupGroup.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupGroupCreateSchema } from '@/lib/schemas/server/backups.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function BackupGroupCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverBackupGroupCreateSchema>
  >({
    initialValues: {
      name: '',
      retentionCount: null,
      retentionDays: null,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(serverBackupGroupCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createBackupGroup(server.uuid, values);
      queryClient.invalidateQueries({
        queryKey: queryKeys.server(server.uuid).backups.groups.all(),
      });
      addToast(t('pages.server.backupGroups.toast.created', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.server.backupGroups.modal.createGroup.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        <NumberInput
          label={t('pages.server.backupGroups.form.retentionCount', {})}
          description={t('pages.server.backupGroups.form.retentionCountDescription', {})}
          min={1}
          allowDecimal={false}
          value={form.values.retentionCount ?? ''}
          error={form.errors.retentionCount}
          onChange={(v) => form.setFieldValue('retentionCount', v === '' || v === undefined ? null : Number(v))}
        />

        <NumberInput
          label={t('pages.server.backupGroups.form.retentionDays', {})}
          description={t('pages.server.backupGroups.form.retentionDaysDescription', {})}
          min={1}
          allowDecimal={false}
          value={form.values.retentionDays ?? ''}
          error={form.errors.retentionDays}
          onChange={(v) => form.setFieldValue('retentionDays', v === '' || v === undefined ? null : Number(v))}
        />

        {!form.values.retentionCount && !form.values.retentionDays && (
          <Alert color='blue' icon={<FontAwesomeIcon icon={faCircleInfo} />}>
            {t('pages.server.backupGroups.form.noRetentionDescription', {})}
          </Alert>
        )}

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
