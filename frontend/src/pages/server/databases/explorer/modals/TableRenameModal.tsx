import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverDatabaseSchemaTableSchema, serverDatabaseTableRenameSchema } from '@/lib/schemas/server/databases.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TableRenameModal({
  table,
  onRenamed,
  ...props
}: ModalProps & {
  table: z.infer<typeof serverDatabaseSchemaTableSchema>;
  onRenamed: (name: string) => void;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { api, keys } = useDatabaseExplorer();
  const queryClient = useQueryClient();

  const values = serverDatabaseTableRenameSchema.pick({ name: true });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof values>>({
    initialValues: { name: table.name },
    validate: zod4Resolver(values),
    onClose: props.onClose,
    onSubmit: async (data) => {
      await api.renameTable({
        schema: table.schema,
        table: table.name,
        name: data.name,
      });
      await queryClient.invalidateQueries({ queryKey: keys.schema });
      addToast(t('pages.server.databases.explorer.modal.renameTable.toast.renamed', { table: data.name }), 'success');
      onRenamed(data.name);
    },
  });

  useEffect(() => {
    if (props.opened) {
      const values = { name: table.name };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

  return (
    <FormModal
      title={t('pages.server.databases.explorer.modal.renameTable.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('pages.server.databases.explorer.form.tableName', {})}
          {...form.getInputProps('name')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('pages.server.databases.explorer.button.rename', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
