import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import Button from '@/elements/buttons/Button.tsx';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import {
  serverDatabaseColumnDefinitionSchema,
  serverDatabaseSchemaTableSchema,
} from '@/lib/schemas/server/databases.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ColumnCreateModal({
  table,
  ...props
}: ModalProps & {
  table: z.infer<typeof serverDatabaseSchemaTableSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { api, keys } = useDatabaseExplorer();
  const queryClient = useQueryClient();

  const { data: columnTypes = [] } = useResource({
    queryKey: keys.columnTypes,
    queryFn: api.getColumnTypes,
    enabled: props.opened,
  });

  const values = serverDatabaseColumnDefinitionSchema.pick({ name: true, type: true, nullable: true });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof values>>({
    initialValues: { name: '', type: '', nullable: true },
    validate: zod4Resolver(values),
    onClose: props.onClose,
    onSubmit: async (data) => {
      await api.createColumn({
        schema: table.schema,
        table: table.name,
        column: { ...data, primaryKey: false, autoIncrement: false },
      });
      queryClient.invalidateQueries({ queryKey: keys.schema });
      queryClient.invalidateQueries({ queryKey: keys.rows });
      addToast(t('pages.server.databases.explorer.modal.createColumn.toast.created', { column: data.name }), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.server.databases.explorer.modal.createColumn.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('pages.server.databases.explorer.form.columnName', {})}
          {...form.getInputProps('name')}
        />

        <Autocomplete
          withAsterisk
          label={t('common.form.type', {})}
          data={columnTypes}
          {...form.getInputProps('type')}
        />

        <Checkbox
          label={t('pages.server.databases.explorer.form.nullable', {})}
          description={t('pages.server.databases.explorer.modal.createColumn.form.nullableHint', {})}
          {...form.getInputProps('nullable', { type: 'checkbox' })}
        />

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
