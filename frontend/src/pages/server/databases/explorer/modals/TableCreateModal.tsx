import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Divider from '@/elements/Divider.tsx';
import Group from '@/elements/Group.tsx';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import {
  serverDatabaseColumnDefinitionSchema,
  serverDatabaseTableCreateSchema,
} from '@/lib/schemas/server/databases.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TableCreateModal({
  onCreated,
  ...props
}: ModalProps & {
  onCreated: (table: string) => void;
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

  const values = z.object({
    table: serverDatabaseTableCreateSchema.shape.table,
    columns: serverDatabaseTableCreateSchema.shape.columns,
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof values>>({
    initialValues: {
      table: '',
      columns: [{ name: 'id', type: 'bigint', nullable: false, primaryKey: true, autoIncrement: true }],
    },
    validate: zod4Resolver(values),
    onClose: props.onClose,
    onSubmit: async (data) => {
      await api.createTable({ schema: null, ...data });
      await queryClient.invalidateQueries({ queryKey: keys.schema });
      addToast(t('pages.server.databases.explorer.modal.createTable.toast.created', { table: data.table }), 'success');
      onCreated(data.table);
    },
  });

  const addColumn = () => {
    form.insertListItem('columns', {
      name: '',
      type: '',
      nullable: true,
      primaryKey: false,
      autoIncrement: false,
    } satisfies z.infer<typeof serverDatabaseColumnDefinitionSchema>);
  };

  return (
    <FormModal
      title={t('pages.server.databases.explorer.modal.createTable.title', {})}
      isDirty={isDirty}
      loading={loading}
      size='lg'
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('pages.server.databases.explorer.form.tableName', {})}
          {...form.getInputProps('table')}
        />

        <div>
          <Title order={4} mb='sm'>
            {t('pages.server.databases.explorer.form.columnsList', {})}
          </Title>
          {form.values.columns.map((_, index) => (
            <div key={`column-${index}`} className='flex flex-col'>
              {index !== 0 && <Divider my='sm' />}

              <div className='flex flex-row items-end space-x-2 mb-2'>
                <TextInput
                  withAsterisk
                  label={t('pages.server.databases.explorer.form.columnName', {})}
                  className='flex-1'
                  {...form.getInputProps(`columns.${index}.name`)}
                />
                <Autocomplete
                  withAsterisk
                  label={t('common.form.type', {})}
                  className='w-44'
                  data={columnTypes}
                  {...form.getInputProps(`columns.${index}.type`)}
                />
                <ActionIcon
                  size='input-sm'
                  color='red'
                  variant='light'
                  disabled={form.values.columns.length === 1}
                  onClick={() => form.removeListItem('columns', index)}
                >
                  <FontAwesomeIcon icon={faMinus} />
                </ActionIcon>
              </div>

              <Group gap='md'>
                <Checkbox
                  label={t('pages.server.databases.explorer.form.nullable', {})}
                  {...form.getInputProps(`columns.${index}.nullable`, { type: 'checkbox' })}
                />
                <Checkbox
                  label={t('pages.server.databases.explorer.form.primaryKey', {})}
                  {...form.getInputProps(`columns.${index}.primaryKey`, { type: 'checkbox' })}
                />
                <Checkbox
                  label={t('pages.server.databases.explorer.form.autoIncrement', {})}
                  {...form.getInputProps(`columns.${index}.autoIncrement`, { type: 'checkbox' })}
                />
              </Group>
            </div>
          ))}

          <Button variant='light' mt='sm' leftSection={<FontAwesomeIcon icon={faPlus} />} onClick={addColumn}>
            {t('pages.server.databases.explorer.button.addColumn', {})}
          </Button>
        </div>

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
